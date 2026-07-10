-- Fixture data for scripts/test_critical_paths.sh. Run once, as the
-- superuser, after all migrations. Deliberately minimal: just enough rows
-- for the RLS/RPC checks that follow to have something real to act on.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@critical-path.test'),
  ('22222222-2222-2222-2222-222222222222', 'outsider@critical-path.test'),
  ('33333333-3333-3333-3333-333333333333', 'admin@critical-path.test')
on conflict (id) do nothing;

-- auth.users insert above already created these via handle_new_user()
-- (on_auth_user_created trigger) — update in place rather than
-- on-conflict-do-nothing, so is_admin actually takes effect.
insert into public.profiles (id, full_name, is_admin) values
  ('11111111-1111-1111-1111-111111111111', 'Critical Path Owner', false),
  ('22222222-2222-2222-2222-222222222222', 'Critical Path Outsider', false),
  ('33333333-3333-3333-3333-333333333333', 'Critical Path Admin', true)
on conflict (id) do update set full_name = excluded.full_name, is_admin = excluded.is_admin;

insert into public.organizations (id, owner_id, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Critical Path Test Org')
on conflict (id) do nothing;

insert into public.meetings (id, organization_id, contact_email, contact_name, status, estimated_value)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'prospect@example.com', 'Prospect Person', 'completed', 5000)
on conflict (id) do nothing;

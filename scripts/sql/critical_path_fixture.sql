-- Fixture data for scripts/test_critical_paths.sh. Run once, as the
-- superuser, after all migrations. Deliberately minimal: just enough rows
-- for the RLS/RPC checks that follow to have something real to act on.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@critical-path.test'),
  ('22222222-2222-2222-2222-222222222222', 'outsider@critical-path.test'),
  ('33333333-3333-3333-3333-333333333333', 'admin@critical-path.test'),
  ('44444444-4444-4444-4444-444444444444', 'member@critical-path.test')
on conflict (id) do nothing;

-- auth.users insert above already created these via handle_new_user()
-- (on_auth_user_created trigger) — update in place rather than
-- on-conflict-do-nothing, so is_admin actually takes effect.
insert into public.profiles (id, full_name, is_admin) values
  ('11111111-1111-1111-1111-111111111111', 'Critical Path Owner', false),
  ('22222222-2222-2222-2222-222222222222', 'Critical Path Outsider', false),
  ('33333333-3333-3333-3333-333333333333', 'Critical Path Admin', true),
  ('44444444-4444-4444-4444-444444444444', 'Critical Path Member', false)
on conflict (id) do update set full_name = excluded.full_name, is_admin = excluded.is_admin;

insert into public.organizations (id, owner_id, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Critical Path Test Org')
on conflict (id) do nothing;

-- A non-owner org member — needed to prove migration 022's widened
-- support_conversations RLS (org members can see each other's
-- conversations, not just their own) rather than trivially passing
-- because the owner happens to also be the submitter.
insert into public.organization_members (organization_id, user_id, role_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', id
from public.organization_roles where slug = 'agent'
on conflict (organization_id, user_id) do nothing;

insert into public.meetings (id, organization_id, contact_email, contact_name, status, estimated_value)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'prospect@example.com', 'Prospect Person', 'completed', 5000)
on conflict (id) do nothing;

-- Submitted by the non-owner member, not the owner, so the owner-visibility
-- check below actually exercises the widened RLS policy.
insert into public.support_conversations (id, organization_id, user_id, subject, category, status)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Test conversation', 'question', 'open')
on conflict (id) do nothing;

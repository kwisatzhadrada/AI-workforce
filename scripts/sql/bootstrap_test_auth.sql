-- Minimal stand-in for what real Supabase already provides, so migrations
-- written against auth.uid()/auth.role()/anon/authenticated/service_role
-- run unmodified against a plain local Postgres 16 instance. Must run
-- BEFORE any migration — the `alter default privileges` calls below only
-- affect objects created after they run, which is exactly how Supabase's
-- own one-time project grants behave. Applying an equivalent grant AFTER
-- migrations would silently re-grant EXECUTE on functions a migration
-- deliberately REVOKEd (a real bug this project hit once already).

create extension if not exists pgcrypto;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$$;

-- service_role must bypass RLS the same way Supabase's real service_role
-- does. Roles are cluster-level, so a role left over from a previous run
-- can silently already exist WITHOUT this attribute — always set it
-- unconditionally rather than gating it inside the `if not exists` above.
alter role service_role bypassrls;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

-- Real Supabase projects ship a `supabase_realtime` publication out of
-- the box; migrations that opt tables into it assume it already exists.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, anon;
alter default privileges in schema public grant usage, select on sequences to authenticated, anon;
alter default privileges in schema public grant execute on functions to authenticated, anon;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to service_role;

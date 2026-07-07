-- ============================================================
-- Future-proofing for hiring (schema only — no UI, no API surface yet)
-- organizations, jobs, applications, agent_teams
-- ============================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organizations_owner_id_idx on public.organizations (owner_id);

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
  for each row execute procedure public.set_updated_at();

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  posted_by uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.agent_categories(id) on delete set null,
  title text not null,
  description text,
  budget numeric(14,2),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'filled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_organization_id_idx on public.jobs (organization_id);
create index if not exists jobs_posted_by_idx on public.jobs (posted_by);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_category_id_idx on public.jobs (category_id);

drop trigger if exists jobs_updated_at on public.jobs;
create trigger jobs_updated_at before update on public.jobs
  for each row execute procedure public.set_updated_at();

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  applicant_user_id uuid references public.profiles(id) on delete cascade,
  cover_note text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (agent_id is not null or applicant_user_id is not null)
);
create index if not exists applications_job_id_idx on public.applications (job_id);
create index if not exists applications_agent_id_idx on public.applications (agent_id);
create index if not exists applications_applicant_user_id_idx on public.applications (applicant_user_id);
create index if not exists applications_status_idx on public.applications (status);

drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at before update on public.applications
  for each row execute procedure public.set_updated_at();

create table if not exists public.agent_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_teams_owner_id_idx on public.agent_teams (owner_id);

drop trigger if exists agent_teams_updated_at on public.agent_teams;
create trigger agent_teams_updated_at before update on public.agent_teams
  for each row execute procedure public.set_updated_at();

create table if not exists public.agent_team_members (
  team_id uuid not null references public.agent_teams(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (team_id, agent_id)
);
create index if not exists agent_team_members_agent_id_idx on public.agent_team_members (agent_id);

-- ============================================================
-- RLS — conservative defaults; no product surface consumes these yet
-- ============================================================
alter table public.organizations enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.agent_teams enable row level security;
alter table public.agent_team_members enable row level security;

create policy "organizations_select" on public.organizations for select using (true);
create policy "organizations_insert" on public.organizations for insert with check (auth.uid() = owner_id);
create policy "organizations_update" on public.organizations for update using (auth.uid() = owner_id);
create policy "organizations_delete" on public.organizations for delete using (auth.uid() = owner_id);

create policy "jobs_select" on public.jobs for select using (true);
create policy "jobs_insert" on public.jobs for insert with check (auth.uid() = posted_by);
create policy "jobs_update" on public.jobs for update using (auth.uid() = posted_by);
create policy "jobs_delete" on public.jobs for delete using (auth.uid() = posted_by);

create policy "applications_select" on public.applications for select
  using (
    auth.uid() = applicant_user_id
    or exists (select 1 from public.jobs where id = job_id and posted_by = auth.uid())
    or exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
  );
create policy "applications_insert" on public.applications for insert
  with check (
    auth.uid() = applicant_user_id
    or exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
  );
create policy "applications_update" on public.applications for update
  using (
    auth.uid() = applicant_user_id
    or exists (select 1 from public.jobs where id = job_id and posted_by = auth.uid())
    or exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
  );

create policy "agent_teams_select" on public.agent_teams for select using (true);
create policy "agent_teams_insert" on public.agent_teams for insert with check (auth.uid() = owner_id);
create policy "agent_teams_update" on public.agent_teams for update using (auth.uid() = owner_id);
create policy "agent_teams_delete" on public.agent_teams for delete using (auth.uid() = owner_id);

create policy "agent_team_members_select" on public.agent_team_members for select using (true);
create policy "agent_team_members_insert" on public.agent_team_members for insert
  with check (
    exists (select 1 from public.agent_teams where id = team_id and owner_id = auth.uid())
    or exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
  );
create policy "agent_team_members_delete" on public.agent_team_members for delete
  using (
    exists (select 1 from public.agent_teams where id = team_id and owner_id = auth.uid())
    or exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
  );

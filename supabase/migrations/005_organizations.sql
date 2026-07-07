-- ============================================================
-- Organization Layer (Phase 3)
-- Organizations become the primary entity: they manage agents
-- (via departments + assignments), have a human member hierarchy,
-- roll up denormalized performance metrics, log a public activity
-- feed, and run lightweight multi-step workflows across agents.
-- ============================================================

-- ============================================================
-- 1. EXPAND ORGANIZATIONS
-- ============================================================
alter table public.organizations add column if not exists avatar_url text;
alter table public.organizations add column if not exists website_url text;
alter table public.organizations add column if not exists industry text;

-- ============================================================
-- 2. ROLE HIERARCHY
-- ============================================================
-- Owner (0) > Manager (1) > Supervisor (2) > Agent (3). Table-driven so
-- custom roles can be added later without a schema change. "Agent" is the
-- base rung: today it is informational (AI agents don't log in), but
-- agent_assignments.manager_type already supports an *agent* as a manager,
-- so agent-managing-agent needs no further schema change when it lands.
create table if not exists public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  level integer not null unique,
  created_at timestamptz not null default now()
);

insert into public.organization_roles (slug, name, level) values
  ('owner', 'Owner', 0),
  ('manager', 'Manager', 1),
  ('supervisor', 'Supervisor', 2),
  ('agent', 'Agent', 3)
on conflict (slug) do nothing;

create or replace function public.is_org_manager(p_org_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    exists (select 1 from public.organizations where id = p_org_id and owner_id = p_user_id)
    or exists (
      select 1 from public.organization_members m
      join public.organization_roles r on r.id = m.role_id
      where m.organization_id = p_org_id and m.user_id = p_user_id and r.level <= 1
    );
$$;

create or replace function public.is_org_member(p_org_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    exists (select 1 from public.organizations where id = p_org_id and owner_id = p_user_id)
    or exists (select 1 from public.organization_members where organization_id = p_org_id and user_id = p_user_id);
$$;

-- ============================================================
-- 3. MEMBERS (Organization -> many Human Owners)
-- ============================================================
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.organization_roles(id),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists organization_members_organization_id_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_id_idx on public.organization_members (user_id);

drop trigger if exists organization_members_updated_at on public.organization_members;
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 4. DEPARTMENTS (Organization -> many Departments -> many Agents)
-- ============================================================
create table if not exists public.organization_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists organization_departments_organization_id_idx on public.organization_departments (organization_id);

drop trigger if exists organization_departments_updated_at on public.organization_departments;
create trigger organization_departments_updated_at before update on public.organization_departments
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 5. AGENT ASSIGNMENTS (Organization -> many Agents)
-- ============================================================
-- manager_type/manager_id is polymorphic (mirrors public.follows): a
-- human profile today, an agent once agent-managing-agent ships — no
-- schema change needed when that day comes.
create table if not exists public.agent_assignments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.organization_departments(id) on delete set null,
  manager_type text check (manager_type in ('user', 'agent')),
  manager_id uuid,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'removed')),
  assigned_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manager_type is null or manager_id is not null)
);
create index if not exists agent_assignments_agent_id_idx on public.agent_assignments (agent_id);
create index if not exists agent_assignments_organization_id_idx on public.agent_assignments (organization_id);
create index if not exists agent_assignments_department_id_idx on public.agent_assignments (department_id);
create index if not exists agent_assignments_status_idx on public.agent_assignments (status);
create unique index if not exists agent_assignments_one_active_per_department
  on public.agent_assignments (agent_id, department_id) where status = 'active';

drop trigger if exists agent_assignments_updated_at on public.agent_assignments;
create trigger agent_assignments_updated_at before update on public.agent_assignments
  for each row execute procedure public.set_updated_at();

-- Guard against assigning an agent to a department that belongs to a different org.
create or replace function public.check_agent_assignment_department()
returns trigger language plpgsql as $$
begin
  if new.department_id is not null and not exists (
    select 1 from public.organization_departments where id = new.department_id and organization_id = new.organization_id
  ) then
    raise exception 'department does not belong to this organization';
  end if;
  return new;
end;
$$;

drop trigger if exists agent_assignments_check_department on public.agent_assignments;
create trigger agent_assignments_check_department before insert or update on public.agent_assignments
  for each row execute procedure public.check_agent_assignment_department();

-- ============================================================
-- 6. ORGANIZATION METRICS (denormalized rollup, 1:1 with organizations)
-- ============================================================
create table if not exists public.organization_metrics (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  total_agents integer not null default 0,
  active_agents integer not null default 0,
  tasks_completed bigint not null default 0,
  tasks_failed bigint not null default 0,
  success_rate numeric(5,2) not null default 0,
  trust_score numeric(5,2) not null default 0,
  reputation_score numeric(3,2) not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.recompute_organization_metrics(p_org_id uuid)
returns void language plpgsql security definer as $$
declare
  v_total_agents integer;
  v_active_agents integer;
  v_tasks_completed bigint;
  v_tasks_failed bigint;
  v_success_rate numeric;
  v_trust_score numeric;
  v_reputation_score numeric;
begin
  select count(distinct agent_id) into v_total_agents
  from public.agent_assignments where organization_id = p_org_id and status <> 'removed';

  select count(distinct agent_id) into v_active_agents
  from public.agent_assignments where organization_id = p_org_id and status = 'active';

  select
    coalesce(sum(pm.tasks_completed), 0),
    coalesce(sum(pm.tasks_failed), 0),
    coalesce(avg(a.trust_score), 0),
    coalesce(avg(a.reputation_score), 0)
  into v_tasks_completed, v_tasks_failed, v_trust_score, v_reputation_score
  from (
    select distinct agent_id from public.agent_assignments
    where organization_id = p_org_id and status = 'active'
  ) active_agent_ids
  join public.agents a on a.id = active_agent_ids.agent_id
  left join public.agent_performance_metrics pm on pm.agent_id = a.id;

  v_success_rate := case
    when (v_tasks_completed + v_tasks_failed) > 0
    then round(v_tasks_completed::numeric / (v_tasks_completed + v_tasks_failed) * 100, 2)
    else 0
  end;

  insert into public.organization_metrics (
    organization_id, total_agents, active_agents, tasks_completed, tasks_failed,
    success_rate, trust_score, reputation_score, updated_at
  )
  values (
    p_org_id, v_total_agents, v_active_agents, v_tasks_completed, v_tasks_failed,
    v_success_rate, round(v_trust_score, 2), round(v_reputation_score, 2), now()
  )
  on conflict (organization_id) do update set
    total_agents = excluded.total_agents,
    active_agents = excluded.active_agents,
    tasks_completed = excluded.tasks_completed,
    tasks_failed = excluded.tasks_failed,
    success_rate = excluded.success_rate,
    trust_score = excluded.trust_score,
    reputation_score = excluded.reputation_score,
    updated_at = now();
end;
$$;

-- ============================================================
-- 7. ACTIVITY GRAPH
-- ============================================================
create table if not exists public.organization_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'member_joined', 'member_removed', 'agent_joined', 'agent_removed',
    'department_created', 'verification_earned', 'trust_score_changed',
    'assignment_completed', 'workflow_completed'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists organization_activity_org_id_idx on public.organization_activity (organization_id, created_at desc);
create index if not exists organization_activity_type_idx on public.organization_activity (activity_type);

create or replace function public.log_organization_activity(p_org_id uuid, p_type text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
begin
  insert into public.organization_activity (organization_id, activity_type, payload) values (p_org_id, p_type, p_payload);
end;
$$;

-- ============================================================
-- 8. WIRING: organization creation defaults (owner membership + standard departments)
-- ============================================================
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer as $$
declare
  v_owner_role_id uuid;
  v_dept text;
  v_standard_departments text[] := array['Sales', 'Marketing', 'Research', 'Operations', 'Support', 'Finance', 'Development'];
begin
  select id into v_owner_role_id from public.organization_roles where slug = 'owner';

  insert into public.organization_members (organization_id, user_id, role_id)
  values (new.id, new.owner_id, v_owner_role_id)
  on conflict (organization_id, user_id) do nothing;

  foreach v_dept in array v_standard_departments loop
    insert into public.organization_departments (organization_id, name, slug, is_custom)
    values (new.id, v_dept, lower(v_dept), false)
    on conflict (organization_id, slug) do nothing;
  end loop;

  insert into public.organization_metrics (organization_id) values (new.id)
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

drop trigger if exists organizations_after_insert on public.organizations;
create trigger organizations_after_insert after insert on public.organizations
  for each row execute procedure public.handle_new_organization();

-- ============================================================
-- 9. WIRING: activity + metrics on membership, departments, assignments
-- ============================================================
create or replace function public.trg_org_members_after_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_organization_activity(new.organization_id, 'member_joined', jsonb_build_object('user_id', new.user_id, 'role_id', new.role_id));
  return new;
end;
$$;
drop trigger if exists organization_members_after_insert on public.organization_members;
create trigger organization_members_after_insert after insert on public.organization_members
  for each row execute procedure public.trg_org_members_after_insert();

create or replace function public.trg_org_members_after_delete()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_organization_activity(old.organization_id, 'member_removed', jsonb_build_object('user_id', old.user_id));
  return old;
end;
$$;
drop trigger if exists organization_members_after_delete on public.organization_members;
create trigger organization_members_after_delete after delete on public.organization_members
  for each row execute procedure public.trg_org_members_after_delete();

create or replace function public.trg_org_departments_after_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_organization_activity(new.organization_id, 'department_created', jsonb_build_object('department_id', new.id, 'name', new.name));
  return new;
end;
$$;
drop trigger if exists organization_departments_after_insert on public.organization_departments;
create trigger organization_departments_after_insert after insert on public.organization_departments
  for each row execute procedure public.trg_org_departments_after_insert();

create or replace function public.trg_agent_assignments_after_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_organization_metrics(new.organization_id);
  perform public.log_organization_activity(new.organization_id, 'agent_joined', jsonb_build_object('agent_id', new.agent_id, 'department_id', new.department_id));
  return new;
end;
$$;
drop trigger if exists agent_assignments_after_insert on public.agent_assignments;
create trigger agent_assignments_after_insert after insert on public.agent_assignments
  for each row execute procedure public.trg_agent_assignments_after_insert();

create or replace function public.trg_agent_assignments_after_update()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_organization_metrics(new.organization_id);
  if old.organization_id is distinct from new.organization_id then
    perform public.recompute_organization_metrics(old.organization_id);
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    perform public.log_organization_activity(new.organization_id, 'assignment_completed', jsonb_build_object('agent_id', new.agent_id, 'department_id', new.department_id));
  end if;
  if new.status = 'removed' and old.status <> 'removed' then
    perform public.log_organization_activity(new.organization_id, 'agent_removed', jsonb_build_object('agent_id', new.agent_id));
  end if;
  return new;
end;
$$;
drop trigger if exists agent_assignments_after_update on public.agent_assignments;
create trigger agent_assignments_after_update after update on public.agent_assignments
  for each row execute procedure public.trg_agent_assignments_after_update();

create or replace function public.trg_agent_assignments_after_delete()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_organization_metrics(old.organization_id);
  perform public.log_organization_activity(old.organization_id, 'agent_removed', jsonb_build_object('agent_id', old.agent_id));
  return old;
end;
$$;
drop trigger if exists agent_assignments_after_delete on public.agent_assignments;
create trigger agent_assignments_after_delete after delete on public.agent_assignments
  for each row execute procedure public.trg_agent_assignments_after_delete();

-- Any agent metric that feeds organization_metrics changed: refresh every org
-- this agent is actively assigned to, and log a trust-score-changed event
-- when the move is large enough to be worth surfacing (>= 5 points).
create or replace function public.trg_agent_metrics_changed_orgs()
returns trigger language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_trust_delta numeric := coalesce(new.trust_score, 0) - coalesce(old.trust_score, 0);
begin
  for v_org_id in
    select distinct organization_id from public.agent_assignments
    where agent_id = new.id and status = 'active'
  loop
    perform public.recompute_organization_metrics(v_org_id);
    if abs(v_trust_delta) >= 5 then
      perform public.log_organization_activity(v_org_id, 'trust_score_changed', jsonb_build_object(
        'agent_id', new.id, 'agent_name', new.name, 'old_score', old.trust_score, 'new_score', new.trust_score
      ));
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists agents_after_update_org_metrics on public.agents;
create trigger agents_after_update_org_metrics after update of trust_score, performance_score, reputation_score on public.agents
  for each row execute procedure public.trg_agent_metrics_changed_orgs();

-- Verification earned by an agent surfaces in every org it's actively assigned to.
create or replace function public.trg_org_activity_verification()
returns trigger language plpgsql security definer as $$
declare
  v_org_id uuid;
begin
  if new.status = 'active' and (old.status is null or old.status <> 'active') then
    for v_org_id in
      select distinct organization_id from public.agent_assignments
      where agent_id = new.agent_id and status = 'active'
    loop
      perform public.log_organization_activity(v_org_id, 'verification_earned', jsonb_build_object(
        'agent_id', new.agent_id, 'level', new.level, 'type', new.verification_type
      ));
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists agent_verifications_after_change_org_activity on public.agent_verifications;
create trigger agent_verifications_after_change_org_activity after insert or update on public.agent_verifications
  for each row execute procedure public.trg_org_activity_verification();

-- ============================================================
-- 10. LIGHTWEIGHT WORKFLOW ENGINE
-- ============================================================
-- e.g. Lead Arrives -> Research Agent -> Sales Agent -> Support Agent
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workflows_organization_id_idx on public.workflows (organization_id);

drop trigger if exists workflows_updated_at on public.workflows;
create trigger workflows_updated_at before update on public.workflows
  for each row execute procedure public.set_updated_at();

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  name text not null,
  department_id uuid references public.organization_departments(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);
create index if not exists workflow_steps_workflow_id_idx on public.workflow_steps (workflow_id, step_order);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  current_step_order integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workflow_runs_workflow_id_idx on public.workflow_runs (workflow_id);
create index if not exists workflow_runs_organization_id_idx on public.workflow_runs (organization_id, created_at desc);

drop trigger if exists workflow_runs_updated_at on public.workflow_runs;
create trigger workflow_runs_updated_at before update on public.workflow_runs
  for each row execute procedure public.set_updated_at();

create table if not exists public.workflow_step_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_run_id, workflow_step_id)
);
create index if not exists workflow_step_runs_run_id_idx on public.workflow_step_runs (workflow_run_id);

drop trigger if exists workflow_step_runs_updated_at on public.workflow_step_runs;
create trigger workflow_step_runs_updated_at before update on public.workflow_step_runs
  for each row execute procedure public.set_updated_at();

-- Completion of a run is its own organization-activity event.
create or replace function public.trg_workflow_runs_after_update()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.log_organization_activity(new.organization_id, 'workflow_completed', jsonb_build_object('workflow_id', new.workflow_id, 'workflow_run_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists workflow_runs_after_update_activity on public.workflow_runs;
create trigger workflow_runs_after_update_activity after update on public.workflow_runs
  for each row execute procedure public.trg_workflow_runs_after_update();

-- Start a run: snapshots every step into a pending step-run, activates the first.
create or replace function public.start_workflow_run(p_workflow_id uuid)
returns public.workflow_runs
language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_run public.workflow_runs;
  v_step record;
  v_step_count integer;
begin
  select organization_id into v_org_id from public.workflows where id = p_workflow_id;
  if v_org_id is null then
    raise exception 'workflow not found';
  end if;
  if not public.is_org_manager(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select count(*) into v_step_count from public.workflow_steps where workflow_id = p_workflow_id;
  if v_step_count = 0 then
    raise exception 'workflow has no steps';
  end if;

  insert into public.workflow_runs (workflow_id, organization_id, status, current_step_order, started_at)
  values (p_workflow_id, v_org_id, 'in_progress', 1, now())
  returning * into v_run;

  for v_step in select * from public.workflow_steps where workflow_id = p_workflow_id order by step_order loop
    insert into public.workflow_step_runs (workflow_run_id, workflow_step_id, agent_id, status, started_at)
    values (
      v_run.id, v_step.id, v_step.agent_id,
      case when v_step.step_order = 1 then 'in_progress' else 'pending' end,
      case when v_step.step_order = 1 then now() else null end
    );
  end loop;

  return v_run;
end;
$$;

-- Advance a run: resolves the current step, then either activates the next
-- step (a handoff) or completes/fails the whole run.
create or replace function public.advance_workflow_run(p_run_id uuid, p_status text default 'completed', p_notes text default null)
returns public.workflow_runs
language plpgsql security definer as $$
declare
  v_run public.workflow_runs;
  v_current_step_run_id uuid;
  v_next_step public.workflow_steps;
begin
  select * into v_run from public.workflow_runs where id = p_run_id;
  if v_run.id is null then
    raise exception 'run not found';
  end if;
  if not public.is_org_manager(v_run.organization_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if v_run.status not in ('pending', 'in_progress') then
    raise exception 'run is already %', v_run.status;
  end if;
  if p_status not in ('completed', 'failed', 'skipped') then
    raise exception 'invalid step status';
  end if;

  select wsr.id into v_current_step_run_id
  from public.workflow_step_runs wsr
  join public.workflow_steps ws on ws.id = wsr.workflow_step_id
  where wsr.workflow_run_id = p_run_id and ws.step_order = v_run.current_step_order;

  update public.workflow_step_runs
  set status = p_status, notes = coalesce(p_notes, notes), completed_at = now()
  where id = v_current_step_run_id;

  if p_status = 'failed' then
    update public.workflow_runs set status = 'failed', completed_at = now() where id = p_run_id returning * into v_run;
    return v_run;
  end if;

  select * into v_next_step from public.workflow_steps
  where workflow_id = v_run.workflow_id and step_order = v_run.current_step_order + 1;

  if v_next_step.id is null then
    update public.workflow_runs set status = 'completed', completed_at = now() where id = p_run_id returning * into v_run;
  else
    update public.workflow_step_runs set status = 'in_progress', started_at = now()
    where workflow_run_id = p_run_id and workflow_step_id = v_next_step.id;

    update public.workflow_runs set current_step_order = v_next_step.step_order where id = p_run_id returning * into v_run;
  end if;

  return v_run;
end;
$$;

-- ============================================================
-- 11. RLS
-- ============================================================
alter table public.organization_roles enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_departments enable row level security;
alter table public.agent_assignments enable row level security;
alter table public.organization_metrics enable row level security;
alter table public.organization_activity enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_step_runs enable row level security;

create policy "organization_roles_select" on public.organization_roles for select using (true);

create policy "organization_members_select" on public.organization_members for select using (true);
create policy "organization_members_insert" on public.organization_members for insert
  with check (public.is_org_manager(organization_id, auth.uid()));
create policy "organization_members_update" on public.organization_members for update
  using (public.is_org_manager(organization_id, auth.uid()));
create policy "organization_members_delete" on public.organization_members for delete
  using (public.is_org_manager(organization_id, auth.uid()) or auth.uid() = user_id);

create policy "organization_departments_select" on public.organization_departments for select using (true);
create policy "organization_departments_insert" on public.organization_departments for insert
  with check (public.is_org_manager(organization_id, auth.uid()));
create policy "organization_departments_update" on public.organization_departments for update
  using (public.is_org_manager(organization_id, auth.uid()));
create policy "organization_departments_delete" on public.organization_departments for delete
  using (public.is_org_manager(organization_id, auth.uid()));

-- Assignment writes: a manager may bring in agents they personally own;
-- once assigned, any manager of the org can update/remove the assignment.
create policy "agent_assignments_select" on public.agent_assignments for select using (true);
create policy "agent_assignments_insert" on public.agent_assignments for insert
  with check (
    public.is_org_manager(organization_id, auth.uid())
    and exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
  );
create policy "agent_assignments_update" on public.agent_assignments for update
  using (public.is_org_manager(organization_id, auth.uid()));
create policy "agent_assignments_delete" on public.agent_assignments for delete
  using (public.is_org_manager(organization_id, auth.uid()));

create policy "organization_metrics_select" on public.organization_metrics for select using (true);
-- No direct write policy: only recompute_organization_metrics() (security definer) writes here.

create policy "organization_activity_select" on public.organization_activity for select using (true);
-- No direct write policy: only log_organization_activity() (security definer) writes here.

create policy "workflows_select" on public.workflows for select using (true);
create policy "workflows_insert" on public.workflows for insert
  with check (public.is_org_manager(organization_id, auth.uid()));
create policy "workflows_update" on public.workflows for update
  using (public.is_org_manager(organization_id, auth.uid()));
create policy "workflows_delete" on public.workflows for delete
  using (public.is_org_manager(organization_id, auth.uid()));

create policy "workflow_steps_select" on public.workflow_steps for select using (true);
create policy "workflow_steps_insert" on public.workflow_steps for insert
  with check (exists (select 1 from public.workflows where id = workflow_id and public.is_org_manager(organization_id, auth.uid())));
create policy "workflow_steps_update" on public.workflow_steps for update
  using (exists (select 1 from public.workflows where id = workflow_id and public.is_org_manager(organization_id, auth.uid())));
create policy "workflow_steps_delete" on public.workflow_steps for delete
  using (exists (select 1 from public.workflows where id = workflow_id and public.is_org_manager(organization_id, auth.uid())));

create policy "workflow_runs_select" on public.workflow_runs for select using (true);
-- Inserts/updates to runs and step-runs happen through the security-definer
-- RPCs above so ownership/authorization is checked in one place.

create policy "workflow_step_runs_select" on public.workflow_step_runs for select using (true);

-- ============================================================
-- 12. BACKFILL: the org row already created by earlier phases (if any)
-- ============================================================
insert into public.organization_metrics (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

insert into public.organization_members (organization_id, user_id, role_id)
select o.id, o.owner_id, r.id
from public.organizations o
join public.organization_roles r on r.slug = 'owner'
on conflict (organization_id, user_id) do nothing;

insert into public.organization_departments (organization_id, name, slug, is_custom)
select o.id, d.name, lower(d.name), false
from public.organizations o
cross join (values ('Sales'), ('Marketing'), ('Research'), ('Operations'), ('Support'), ('Finance'), ('Development')) as d(name)
on conflict (organization_id, slug) do nothing;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.organization_activity;

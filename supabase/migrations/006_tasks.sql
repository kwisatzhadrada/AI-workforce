-- ============================================================
-- Work Execution Layer (Phase 4)
-- Organizations create, assign, execute, track, and complete work.
-- Internal workforce operating system — not a marketplace, not
-- public job posting, no external clients yet. Every completed task
-- feeds back into agent reputation, agent trust score, and
-- organization metrics through the machinery already built in
-- Phases 1-3.
-- ============================================================

-- ============================================================
-- 1. ADDITIONAL ROLE HELPER
-- ============================================================
-- Supervisors run day-to-day task/quality work; owner/manager
-- already covered by is_org_manager(). Kept separate from that
-- function so department/member/workflow config stays manager-only.
create or replace function public.is_org_supervisor(p_org_id uuid, p_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    public.is_org_manager(p_org_id, p_user_id)
    or exists (
      select 1 from public.organization_members m
      join public.organization_roles r on r.id = m.role_id
      where m.organization_id = p_org_id and m.user_id = p_user_id and r.level <= 2
    );
$$;

-- ============================================================
-- 2. TASKS
-- ============================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.organization_departments(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending' check (status in ('pending', 'assigned', 'in_progress', 'review', 'completed', 'failed')),
  due_date timestamptz,

  -- Execution
  started_at timestamptz,
  completed_at timestamptz,
  execution_time_seconds integer generated always as (
    case when completed_at is not null and started_at is not null
      then greatest(0, extract(epoch from (completed_at - started_at))::integer)
      else null
    end
  ) stored,
  output jsonb not null default '{}'::jsonb,
  result_summary text,
  attachments text[] not null default '{}',

  -- Workflow integration (nullable — most tasks are created directly, not by a run)
  workflow_run_id uuid references public.workflow_runs(id) on delete set null,
  workflow_step_id uuid references public.workflow_steps(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_organization_id_idx on public.tasks (organization_id, created_at desc);
create index if not exists tasks_department_id_idx on public.tasks (department_id);
create index if not exists tasks_assigned_agent_id_idx on public.tasks (assigned_agent_id);
create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_priority_idx on public.tasks (priority);
create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists tasks_workflow_run_id_idx on public.tasks (workflow_run_id);
create unique index if not exists tasks_workflow_run_step_unique
  on public.tasks (workflow_run_id, workflow_step_id) where workflow_run_id is not null;

-- Auto-instrument the fields a client shouldn't have to (and shouldn't be able to
-- spoof): status->assigned when an agent lands on a pending task, started_at on
-- entering in_progress, completed_at on entering a terminal state.
create or replace function public.trg_tasks_before_change()
returns trigger language plpgsql as $$
begin
  if new.assigned_agent_id is not null and new.status = 'pending'
     and (tg_op = 'INSERT' or old.assigned_agent_id is null) then
    new.status := 'assigned';
  end if;

  if new.status = 'in_progress'
     and (tg_op = 'INSERT' or old.status is distinct from 'in_progress')
     and new.started_at is null then
    new.started_at := now();
  end if;

  if new.status in ('completed', 'failed')
     and (tg_op = 'INSERT' or old.status not in ('completed', 'failed'))
     and new.completed_at is null then
    new.completed_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_before_change on public.tasks;
create trigger tasks_before_change before insert or update on public.tasks
  for each row execute procedure public.trg_tasks_before_change();

-- ============================================================
-- 3. TASK HISTORY (every task creates events)
-- ============================================================
create table if not exists public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'assigned', 'started', 'completed', 'reviewed', 'failed')),
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists task_history_task_id_idx on public.task_history (task_id, created_at);

create or replace function public.log_task_event(p_task_id uuid, p_event_type text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
begin
  insert into public.task_history (task_id, event_type, actor_id, payload)
  values (p_task_id, p_event_type, auth.uid(), p_payload);
end;
$$;

create or replace function public.trg_tasks_after_insert_history()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_task_event(new.id, 'created', jsonb_build_object('title', new.title));
  if new.assigned_agent_id is not null then
    perform public.log_task_event(new.id, 'assigned', jsonb_build_object('agent_id', new.assigned_agent_id));
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_after_insert_history on public.tasks;
create trigger tasks_after_insert_history after insert on public.tasks
  for each row execute procedure public.trg_tasks_after_insert_history();

create or replace function public.trg_tasks_after_update_history()
returns trigger language plpgsql security definer as $$
begin
  if new.assigned_agent_id is not null and old.assigned_agent_id is distinct from new.assigned_agent_id then
    perform public.log_task_event(new.id, 'assigned', jsonb_build_object('agent_id', new.assigned_agent_id));
  end if;
  if new.status = 'in_progress' and old.status <> 'in_progress' then
    perform public.log_task_event(new.id, 'started', '{}'::jsonb);
  end if;
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.log_task_event(new.id, 'completed', '{}'::jsonb);
  end if;
  if new.status = 'failed' and old.status <> 'failed' then
    perform public.log_task_event(new.id, 'failed', '{}'::jsonb);
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_after_update_history on public.tasks;
create trigger tasks_after_update_history after update on public.tasks
  for each row execute procedure public.trg_tasks_after_update_history();

-- ============================================================
-- 4. TASK REVIEWS -> reputation, trust score, org metrics
-- ============================================================
create table if not exists public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  feedback text,
  quality_score numeric(5,2) check (quality_score between 0 and 100),
  speed_score numeric(5,2) check (speed_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (task_id)
);
create index if not exists task_reviews_task_id_idx on public.task_reviews (task_id);

-- Reputation now aggregates from two sources: manual peer ratings
-- (agent_ratings, Phase 2) and task reviews (this phase). Redefining
-- the Phase-2 trigger function's body — the trigger itself, created in
-- migration 003, keeps firing on agent_ratings changes unchanged.
create or replace function public.recompute_agent_reputation_score(p_agent_id uuid)
returns void language plpgsql security definer as $$
declare
  v_avg numeric;
  v_count integer;
begin
  select avg(score), count(*) into v_avg, v_count
  from (
    select score from public.agent_ratings where agent_id = p_agent_id
    union all
    select tr.rating as score
    from public.task_reviews tr
    join public.tasks t on t.id = tr.task_id
    where t.assigned_agent_id = p_agent_id
  ) combined;

  update public.agents
  set reputation_score = coalesce(round(v_avg::numeric, 2), 0),
      rating_count = coalesce(v_count, 0)
  where id = p_agent_id;
end;
$$;

create or replace function public.recompute_agent_reputation()
returns trigger language plpgsql security definer as $$
declare
  v_agent_id uuid := coalesce(new.agent_id, old.agent_id);
begin
  perform public.recompute_agent_reputation_score(v_agent_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.trg_task_review_reputation()
returns trigger language plpgsql security definer as $$
declare
  v_agent_id uuid;
begin
  select assigned_agent_id into v_agent_id from public.tasks where id = coalesce(new.task_id, old.task_id);
  if v_agent_id is not null then
    perform public.recompute_agent_reputation_score(v_agent_id);
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists task_reviews_after_change_reputation on public.task_reviews;
create trigger task_reviews_after_change_reputation after insert or update or delete on public.task_reviews
  for each row execute procedure public.trg_task_review_reputation();

-- A review submitted while the task is still "in review" completes it — this
-- cascades through the tasks triggers below (timestamps, history, agent
-- performance metrics, org metrics, workflow advance) exactly like any other
-- completion.
create or replace function public.trg_task_review_completes_task()
returns trigger language plpgsql security definer as $$
begin
  update public.tasks set status = 'completed' where id = new.task_id and status = 'review';
  return new;
end;
$$;
drop trigger if exists task_reviews_after_insert_complete on public.task_reviews;
create trigger task_reviews_after_insert_complete after insert on public.task_reviews
  for each row execute procedure public.trg_task_review_completes_task();

create or replace function public.trg_task_reviews_after_insert_history()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_task_event(new.task_id, 'reviewed', jsonb_build_object(
    'rating', new.rating, 'quality_score', new.quality_score, 'speed_score', new.speed_score
  ));
  return new;
end;
$$;
drop trigger if exists task_reviews_after_insert_history on public.task_reviews;
create trigger task_reviews_after_insert_history after insert on public.task_reviews
  for each row execute procedure public.trg_task_reviews_after_insert_history();

-- ============================================================
-- 5. TASK COMPLETION -> agent performance metrics (feeds trust score + org metrics)
-- ============================================================
-- Core logic shared between the owner-facing record_agent_task() RPC (Phase 1)
-- and this phase's automatic task-completion trigger, which has no
-- authenticated "acting owner" to check against.
create or replace function public.apply_task_completion_metrics(p_agent_id uuid, p_success boolean, p_response_time_ms integer default null)
returns void language plpgsql security definer as $$
declare
  v_prior_total integer;
begin
  select tasks_completed + tasks_failed into v_prior_total from public.agent_performance_metrics where agent_id = p_agent_id;

  update public.agent_performance_metrics
  set tasks_completed = tasks_completed + case when p_success then 1 else 0 end,
      tasks_failed = tasks_failed + case when p_success then 0 else 1 end,
      avg_response_time_ms = case
        when p_response_time_ms is null then avg_response_time_ms
        when avg_response_time_ms is null then p_response_time_ms
        else round(((avg_response_time_ms * v_prior_total) + p_response_time_ms) / (v_prior_total + 1.0))
      end,
      last_active_at = now(),
      updated_at = now()
  where agent_id = p_agent_id;

  update public.agent_performance_metrics
  set success_rate = round((tasks_completed::numeric / greatest(tasks_completed + tasks_failed, 1)) * 100, 2)
  where agent_id = p_agent_id;
end;
$$;

create or replace function public.record_agent_task(p_agent_id uuid, p_success boolean, p_response_time_ms integer default null)
returns void language plpgsql security definer as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.agents where id = p_agent_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;
  perform public.apply_task_completion_metrics(p_agent_id, p_success, p_response_time_ms);
end;
$$;

create or replace function public.trg_tasks_after_status_complete()
returns trigger language plpgsql security definer as $$
declare
  v_response_ms integer;
begin
  if new.status in ('completed', 'failed') and old.status not in ('completed', 'failed') and new.assigned_agent_id is not null then
    v_response_ms := case when new.execution_time_seconds is not null then new.execution_time_seconds * 1000 else null end;
    perform public.apply_task_completion_metrics(new.assigned_agent_id, new.status = 'completed', v_response_ms);
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_after_update_metrics on public.tasks;
create trigger tasks_after_update_metrics after update of status on public.tasks
  for each row execute procedure public.trg_tasks_after_status_complete();

-- ============================================================
-- 6. WORKFLOW INTEGRATION
-- ============================================================
-- Shared helper: materialize a task for whichever workflow step just became active.
create or replace function public.create_task_for_workflow_step(p_run_id uuid, p_step_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_step public.workflow_steps%rowtype;
  v_run public.workflow_runs%rowtype;
  v_created_by uuid;
  v_task_id uuid;
begin
  select * into v_step from public.workflow_steps where id = p_step_id;
  select * into v_run from public.workflow_runs where id = p_run_id;
  select created_by into v_created_by from public.workflows where id = v_run.workflow_id;

  insert into public.tasks (
    title, organization_id, department_id, created_by, assigned_agent_id, status,
    workflow_run_id, workflow_step_id
  )
  values (
    v_step.name, v_run.organization_id, v_step.department_id, v_created_by, v_step.agent_id,
    case when v_step.agent_id is not null then 'assigned' else 'pending' end,
    p_run_id, p_step_id
  )
  returning id into v_task_id;

  return v_task_id;
end;
$$;

-- Core advance logic, reusable by the authenticated RPC and by the
-- unauthenticated (system-cascaded) task-completion trigger below.
create or replace function public.advance_workflow_run_core(p_run_id uuid, p_status text, p_notes text default null)
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

    perform public.create_task_for_workflow_step(p_run_id, v_next_step.id);
  end if;

  return v_run;
end;
$$;

create or replace function public.advance_workflow_run(p_run_id uuid, p_status text default 'completed', p_notes text default null)
returns public.workflow_runs
language plpgsql security definer as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.workflow_runs where id = p_run_id;
  if v_org_id is null or not public.is_org_manager(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  return public.advance_workflow_run_core(p_run_id, p_status, p_notes);
end;
$$;

-- start_workflow_run now also materializes a task for step 1.
create or replace function public.start_workflow_run(p_workflow_id uuid)
returns public.workflow_runs
language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_run public.workflow_runs;
  v_step record;
  v_step_count integer;
  v_first_step_id uuid;
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
    if v_step.step_order = 1 then
      v_first_step_id := v_step.id;
    end if;
  end loop;

  perform public.create_task_for_workflow_step(v_run.id, v_first_step_id);

  return v_run;
end;
$$;

-- Completing (or failing) a task tied to a run's current step advances the
-- workflow automatically. A failure here must never block the task's own
-- status update, so workflow-advance errors are swallowed.
create or replace function public.trg_task_advances_workflow()
returns trigger language plpgsql security definer as $$
begin
  if new.workflow_run_id is not null and new.status in ('completed', 'failed') and old.status not in ('completed', 'failed') then
    if exists (
      select 1 from public.workflow_runs r
      join public.workflow_steps s on s.workflow_id = r.workflow_id and s.id = new.workflow_step_id
      where r.id = new.workflow_run_id and r.current_step_order = s.step_order and r.status = 'in_progress'
    ) then
      begin
        perform public.advance_workflow_run_core(new.workflow_run_id, new.status, new.result_summary);
      exception when others then
        null;
      end;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_after_update_advance_workflow on public.tasks;
create trigger tasks_after_update_advance_workflow after update of status on public.tasks
  for each row execute procedure public.trg_task_advances_workflow();

-- ============================================================
-- 7. RLS
-- ============================================================
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
alter table public.task_reviews enable row level security;

-- Internal workforce data — visible to organization members and to the
-- owner of the assigned agent (so an agent owner can see/execute work
-- assigned to their agent even before formally joining the org).
create policy "tasks_select" on public.tasks for select
  using (
    public.is_org_member(organization_id, auth.uid())
    or exists (select 1 from public.agents where id = assigned_agent_id and owner_id = auth.uid())
  );
create policy "tasks_insert" on public.tasks for insert
  with check (public.is_org_supervisor(organization_id, auth.uid()));
create policy "tasks_update" on public.tasks for update
  using (
    public.is_org_supervisor(organization_id, auth.uid())
    or exists (select 1 from public.agents where id = assigned_agent_id and owner_id = auth.uid())
  );
create policy "tasks_delete" on public.tasks for delete
  using (public.is_org_manager(organization_id, auth.uid()));

create policy "task_history_select" on public.task_history for select
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (public.is_org_member(t.organization_id, auth.uid()) or exists (select 1 from public.agents where id = t.assigned_agent_id and owner_id = auth.uid()))
  ));
-- No direct write policy: only log_task_event() (security definer) writes here.

create policy "task_reviews_select" on public.task_reviews for select
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (public.is_org_member(t.organization_id, auth.uid()) or exists (select 1 from public.agents where id = t.assigned_agent_id and owner_id = auth.uid()))
  ));
create policy "task_reviews_insert" on public.task_reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (select 1 from public.tasks t where t.id = task_id and public.is_org_supervisor(t.organization_id, auth.uid()))
  );

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_history;

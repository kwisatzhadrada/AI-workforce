-- ============================================================
-- Autonomous Organization Layer (Phase 6)
-- Organizations operate from goals, not tasks: goal -> plan -> tasks,
-- driven by a manager agent whose every action is logged. Humans stay
-- in control via plan approval/rejection and goal pause/edit.
-- ============================================================

-- ============================================================
-- 1. GOALS
-- ============================================================
create table if not exists public.organization_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'failed')),
  is_paused boolean not null default false,
  target_metrics jsonb not null default '{}'::jsonb,
  deadline timestamptz,
  manager_agent_id uuid references public.agents(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organization_goals_org_id_idx on public.organization_goals (organization_id, created_at desc);
create index if not exists organization_goals_status_idx on public.organization_goals (status);
create index if not exists organization_goals_manager_agent_idx on public.organization_goals (manager_agent_id);

drop trigger if exists organization_goals_updated_at on public.organization_goals;
create trigger organization_goals_updated_at before update on public.organization_goals
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 2. PLANNING ENGINE
-- ============================================================
create table if not exists public.goal_plans (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.organization_goals(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'completed')),
  generated_by text not null default 'human' check (generated_by in ('human', 'ai')),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goal_plans_goal_id_idx on public.goal_plans (goal_id);
create index if not exists goal_plans_status_idx on public.goal_plans (status);

drop trigger if exists goal_plans_updated_at on public.goal_plans;
create trigger goal_plans_updated_at before update on public.goal_plans
  for each row execute procedure public.set_updated_at();

create table if not exists public.goal_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.goal_plans(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  title text not null,
  description text,
  department_id uuid references public.organization_departments(id) on delete set null,
  estimated_effort_hours numeric(6,2),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed')),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, step_order)
);
create index if not exists goal_plan_steps_plan_id_idx on public.goal_plan_steps (plan_id, step_order);
create index if not exists goal_plan_steps_task_id_idx on public.goal_plan_steps (task_id);
create index if not exists goal_plan_steps_status_idx on public.goal_plan_steps (status);

drop trigger if exists goal_plan_steps_updated_at on public.goal_plan_steps;
create trigger goal_plan_steps_updated_at before update on public.goal_plan_steps
  for each row execute procedure public.set_updated_at();

-- Explicit dependency graph rather than assuming a linear chain — a step
-- can wait on more than one predecessor.
create table if not exists public.goal_plan_step_dependencies (
  step_id uuid not null references public.goal_plan_steps(id) on delete cascade,
  depends_on_step_id uuid not null references public.goal_plan_steps(id) on delete cascade,
  primary key (step_id, depends_on_step_id),
  check (step_id <> depends_on_step_id)
);
create index if not exists goal_plan_step_deps_depends_on_idx on public.goal_plan_step_dependencies (depends_on_step_id);

-- Task generation links back: which plan step (if any) produced this task.
alter table public.tasks add column if not exists goal_plan_step_id uuid references public.goal_plan_steps(id) on delete set null;
create index if not exists tasks_goal_plan_step_id_idx on public.tasks (goal_plan_step_id);

-- ============================================================
-- 3. DECISION LOG: extend Phase 5's agent_decisions with explicit
--    inputs/outputs (spec asks for these distinctly from reasoning) and
--    the new manager-agent decision types.
-- ============================================================
alter table public.agent_decisions add column if not exists inputs jsonb not null default '{}'::jsonb;
alter table public.agent_decisions add column if not exists outputs jsonb not null default '{}'::jsonb;

alter table public.agent_decisions drop constraint if exists agent_decisions_decision_type_check;
alter table public.agent_decisions add constraint agent_decisions_decision_type_check
  check (decision_type in (
    'accept_task', 'complete_task', 'request_assistance', 'delegate',
    'create_task', 'assign_task', 'monitor_progress', 'escalate_failure'
  ));

-- ============================================================
-- 4. AGENT UTILIZATION
-- ============================================================
-- Deliberately lean: task_volume/success_rate already live on
-- agent_performance_metrics (Phase 1/4); this table adds only the new
-- signal (cumulative active time). idle_seconds is derived at read time
-- from last_active_at, since it grows continuously and shouldn't be a
-- stored value that goes stale between writes.
create table if not exists public.agent_utilization (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  active_seconds bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.get_agent_utilization(p_agent_id uuid)
returns table (agent_id uuid, idle_seconds bigint, active_seconds bigint, task_volume integer, success_rate numeric)
language sql stable as $$
  select
    a.id,
    case when pm.last_active_at is not null then greatest(0, extract(epoch from (now() - pm.last_active_at))::bigint) else null end,
    coalesce(u.active_seconds, 0),
    coalesce(pm.tasks_completed, 0) + coalesce(pm.tasks_failed, 0),
    coalesce(pm.success_rate, 0)
  from public.agents a
  left join public.agent_performance_metrics pm on pm.agent_id = a.id
  left join public.agent_utilization u on u.agent_id = a.id
  where a.id = p_agent_id;
$$;

create or replace function public.trg_tasks_after_update_utilization()
returns trigger language plpgsql security definer as $$
begin
  if new.status in ('completed', 'failed') and old.status not in ('completed', 'failed')
     and new.assigned_agent_id is not null and new.execution_time_seconds is not null then
    insert into public.agent_utilization (agent_id, active_seconds, updated_at)
    values (new.assigned_agent_id, new.execution_time_seconds, now())
    on conflict (agent_id) do update
      set active_seconds = public.agent_utilization.active_seconds + excluded.active_seconds,
          updated_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_after_update_utilization on public.tasks;
create trigger tasks_after_update_utilization after update of status on public.tasks
  for each row execute procedure public.trg_tasks_after_update_utilization();

alter table public.agent_utilization enable row level security;
create policy "agent_utilization_select" on public.agent_utilization for select using (true);
-- No direct write policy: only the trigger above (security definer) writes here.

-- ============================================================
-- 5. ORGANIZATION STATE
-- ============================================================
create table if not exists public.organization_state (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  active_goals integer not null default 0,
  blocked_goals integer not null default 0,
  resource_utilization numeric(5,2) not null default 0,
  agent_utilization numeric(5,2) not null default 0,
  risk_score numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.compute_organization_risk_score(p_org_id uuid)
returns numeric language plpgsql security definer as $$
declare
  v_active_goals integer;
  v_overdue_goals integer;
  v_overdue_ratio numeric;
  v_recent_completed bigint;
  v_recent_failed bigint;
  v_failure_rate numeric;
  v_avg_trust numeric;
  v_trust_component numeric;
  v_risk numeric;
begin
  select count(*) into v_active_goals from public.organization_goals where organization_id = p_org_id and status = 'active';
  select count(*) into v_overdue_goals from public.organization_goals
    where organization_id = p_org_id and status = 'active' and deadline is not null and deadline < now();
  v_overdue_ratio := case when v_active_goals > 0 then v_overdue_goals::numeric / v_active_goals else 0 end;

  select count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_recent_completed, v_recent_failed
  from public.tasks
  where organization_id = p_org_id and updated_at > now() - interval '30 days' and status in ('completed', 'failed');
  v_failure_rate := case when (v_recent_completed + v_recent_failed) > 0
    then v_recent_failed::numeric / (v_recent_completed + v_recent_failed) else 0 end;

  select avg(a.trust_score) into v_avg_trust
  from (select distinct agent_id from public.agent_assignments where organization_id = p_org_id and status = 'active') aa
  join public.agents a on a.id = aa.agent_id;
  v_trust_component := (100 - coalesce(v_avg_trust, 50)) / 100.0;

  v_risk := (v_overdue_ratio * 40) + (v_failure_rate * 40) + (v_trust_component * 20);
  return round(least(100, greatest(0, v_risk)), 2);
end;
$$;

create or replace function public.recompute_organization_state(p_org_id uuid)
returns void language plpgsql security definer as $$
declare
  v_active_goals integer;
  v_blocked_goals integer;
  v_active_agents integer;
  v_max_concurrent constant integer := 3;
  v_loaded_tasks integer;
  v_busy_agents integer;
  v_resource_utilization numeric;
  v_agent_utilization numeric;
begin
  select count(*) into v_active_goals from public.organization_goals where organization_id = p_org_id and status = 'active' and not is_paused;
  select count(*) into v_blocked_goals from public.organization_goals where organization_id = p_org_id and status = 'active' and is_paused;

  select count(*) into v_active_agents from public.agent_assignments where organization_id = p_org_id and status = 'active';
  select count(*) into v_loaded_tasks from public.tasks where organization_id = p_org_id and status in ('assigned', 'in_progress');
  select count(distinct assigned_agent_id) into v_busy_agents
  from public.tasks where organization_id = p_org_id and status in ('assigned', 'in_progress') and assigned_agent_id is not null;

  v_resource_utilization := case when v_active_agents > 0 then least(100, (v_loaded_tasks::numeric / (v_active_agents * v_max_concurrent)) * 100) else 0 end;
  v_agent_utilization := case when v_active_agents > 0 then least(100, (v_busy_agents::numeric / v_active_agents) * 100) else 0 end;

  insert into public.organization_state (organization_id, active_goals, blocked_goals, resource_utilization, agent_utilization, risk_score, updated_at)
  values (p_org_id, v_active_goals, v_blocked_goals, round(v_resource_utilization, 2), round(v_agent_utilization, 2), public.compute_organization_risk_score(p_org_id), now())
  on conflict (organization_id) do update set
    active_goals = excluded.active_goals,
    blocked_goals = excluded.blocked_goals,
    resource_utilization = excluded.resource_utilization,
    agent_utilization = excluded.agent_utilization,
    risk_score = excluded.risk_score,
    updated_at = now();
end;
$$;

create or replace function public.trg_organization_goals_after_change()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_organization_state(coalesce(new.organization_id, old.organization_id));
  return coalesce(new, old);
end;
$$;
drop trigger if exists organization_goals_after_change_state on public.organization_goals;
create trigger organization_goals_after_change_state after insert or update or delete on public.organization_goals
  for each row execute procedure public.trg_organization_goals_after_change();

create or replace function public.trg_tasks_after_update_org_state()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_organization_state(new.organization_id);
  return new;
end;
$$;
drop trigger if exists tasks_after_update_org_state on public.tasks;
create trigger tasks_after_update_org_state after update of status on public.tasks
  for each row execute procedure public.trg_tasks_after_update_org_state();

alter table public.organization_state enable row level security;
create policy "organization_state_select" on public.organization_state for select
  using (public.is_org_member(organization_id, auth.uid()));
-- No direct write policy: only recompute_organization_state() (security definer) writes here.

-- ============================================================
-- 6. ORGANIZATION ACTIVITY: extend the feed with goal events
-- ============================================================
alter table public.organization_activity drop constraint if exists organization_activity_activity_type_check;
alter table public.organization_activity add constraint organization_activity_activity_type_check
  check (activity_type in (
    'member_joined', 'member_removed', 'agent_joined', 'agent_removed',
    'department_created', 'verification_earned', 'trust_score_changed',
    'assignment_completed', 'workflow_completed',
    'goal_created', 'goal_completed', 'goal_failed', 'plan_approved'
  ));

create or replace function public.trg_organization_goals_after_insert_activity()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_organization_activity(new.organization_id, 'goal_created', jsonb_build_object('goal_id', new.id, 'title', new.title));
  return new;
end;
$$;
drop trigger if exists organization_goals_after_insert_activity on public.organization_goals;
create trigger organization_goals_after_insert_activity after insert on public.organization_goals
  for each row execute procedure public.trg_organization_goals_after_insert_activity();

create or replace function public.trg_organization_goals_after_update_activity()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.log_organization_activity(new.organization_id, 'goal_completed', jsonb_build_object('goal_id', new.id, 'title', new.title));
  elsif new.status = 'failed' and old.status <> 'failed' then
    perform public.log_organization_activity(new.organization_id, 'goal_failed', jsonb_build_object('goal_id', new.id, 'title', new.title));
  end if;
  return new;
end;
$$;
drop trigger if exists organization_goals_after_update_activity on public.organization_goals;
create trigger organization_goals_after_update_activity after update on public.organization_goals
  for each row execute procedure public.trg_organization_goals_after_update_activity();

create or replace function public.trg_goal_plans_after_update_activity()
returns trigger language plpgsql security definer as $$
declare
  v_org_id uuid;
begin
  if new.status = 'approved' and old.status <> 'approved' then
    select organization_id into v_org_id from public.organization_goals where id = new.goal_id;
    perform public.log_organization_activity(v_org_id, 'plan_approved', jsonb_build_object('goal_id', new.goal_id, 'plan_id', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists goal_plans_after_update_activity on public.goal_plans;
create trigger goal_plans_after_update_activity after update on public.goal_plans
  for each row execute procedure public.trg_goal_plans_after_update_activity();

-- ============================================================
-- 7. AUTONOMOUS MANAGER AGENT
-- ============================================================
-- A manager agent creates tasks, assigns them, monitors progress, and
-- escalates failures — every action logged to agent_decisions.
-- log_decision() is the one place a decision row gets written, so the
-- shape (inputs/outputs/reasoning/outcome) is consistent everywhere.
create or replace function public.log_decision(
  p_agent_id uuid, p_task_id uuid, p_execution_id uuid, p_decision_type text,
  p_outcome text, p_reasoning text, p_inputs jsonb default '{}'::jsonb, p_outputs jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into public.agent_decisions (agent_id, task_id, execution_id, decision_type, outcome, reasoning, inputs, outputs)
  values (p_agent_id, p_task_id, p_execution_id, p_decision_type, p_outcome, p_reasoning, p_inputs, p_outputs)
  returning id into v_id;
  return v_id;
end;
$$;

-- Materialize a task from a plan step, attributed to the goal's manager agent.
create or replace function public.create_task_for_goal_plan_step(p_step_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_step public.goal_plan_steps%rowtype;
  v_plan public.goal_plans%rowtype;
  v_goal public.organization_goals%rowtype;
  v_task_id uuid;
begin
  select * into v_step from public.goal_plan_steps where id = p_step_id;
  select * into v_plan from public.goal_plans where id = v_step.plan_id;
  select * into v_goal from public.organization_goals where id = v_plan.goal_id;

  if v_goal.manager_agent_id is null then
    raise exception 'goal has no manager agent assigned';
  end if;

  insert into public.tasks (title, description, organization_id, department_id, created_by, priority, goal_plan_step_id)
  values (v_step.title, v_step.description, v_goal.organization_id, v_step.department_id, v_goal.created_by, v_goal.priority, v_step.id)
  returning id into v_task_id;

  update public.goal_plan_steps set task_id = v_task_id, status = 'in_progress' where id = p_step_id;

  perform public.log_decision(
    v_goal.manager_agent_id, v_task_id, null, 'create_task', 'yes',
    format('Created task for plan step "%s"', v_step.title),
    jsonb_build_object('step_id', p_step_id, 'goal_id', v_goal.id),
    jsonb_build_object('task_id', v_task_id)
  );

  return v_task_id;
end;
$$;

-- Pick the best available agent for a task: active assignment to the org
-- (matching department when the task has one), an enabled capability whose
-- name overlaps the task title when possible, ranked by trust score then
-- utilization, gated by the same accept-task decision every other
-- assignment path uses.
create or replace function public.assign_best_agent_for_task(p_task_id uuid, p_manager_agent_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_task public.tasks%rowtype;
  v_candidate record;
  v_capability_id uuid;
  v_accepted boolean;
begin
  select * into v_task from public.tasks where id = p_task_id;

  for v_candidate in
    select distinct a.id as agent_id, a.trust_score
    from public.agent_assignments aa
    join public.agents a on a.id = aa.agent_id
    where aa.organization_id = v_task.organization_id
      and aa.status = 'active'
      and a.status = 'active'
      and (v_task.department_id is null or aa.department_id = v_task.department_id)
      and a.id <> p_manager_agent_id
    order by a.trust_score desc
    limit 10
  loop
    v_capability_id := null;
    select c.id into v_capability_id
    from public.agent_capabilities c
    where c.agent_id = v_candidate.agent_id and c.enabled
      and (v_task.title ilike '%' || c.name || '%' or c.name ilike '%' || split_part(v_task.title, ' ', 1) || '%')
    limit 1;

    v_accepted := public.decide_agent_accept_task(v_candidate.agent_id, p_task_id, v_capability_id);

    if v_accepted then
      update public.tasks set assigned_agent_id = v_candidate.agent_id where id = p_task_id;

      perform public.log_decision(
        p_manager_agent_id, p_task_id, null, 'assign_task', 'yes',
        format('Assigned to agent %s (trust %s)', v_candidate.agent_id, v_candidate.trust_score),
        jsonb_build_object('candidate_agent_id', v_candidate.agent_id),
        jsonb_build_object('assigned_agent_id', v_candidate.agent_id, 'capability_id', v_capability_id)
      );
      return true;
    end if;
  end loop;

  perform public.log_decision(
    p_manager_agent_id, p_task_id, null, 'assign_task', 'no',
    'No active, capable, available agent found in the target department',
    jsonb_build_object('organization_id', v_task.organization_id, 'department_id', v_task.department_id),
    '{}'::jsonb
  );
  perform public.decide_request_assistance(p_manager_agent_id, p_task_id);

  return false;
end;
$$;

-- Failure of a plan-linked task is escalated: logged and announced to the org.
create or replace function public.escalate_task_failure(p_task_id uuid, p_manager_agent_id uuid)
returns void language plpgsql security definer as $$
declare
  v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id = p_task_id;

  perform public.log_decision(
    p_manager_agent_id, p_task_id, null, 'escalate_failure', 'yes',
    format('Task "%s" failed and was escalated to the organization', v_task.title),
    jsonb_build_object('task_id', p_task_id), '{}'::jsonb
  );

  insert into public.agent_messages (sender_agent_id, receiver_type, receiver_id, message_type, content)
  values (p_manager_agent_id, 'organization', v_task.organization_id, 'alert', format('Task "%s" failed: %s', v_task.title, coalesce(v_task.result_summary, 'no summary provided')));
end;
$$;

-- Roll a plan's step statuses up into plan/goal completion, and note risk
-- when a goal is behind. This is the "monitor progress" decision.
create or replace function public.monitor_goal_progress(p_goal_id uuid, p_manager_agent_id uuid)
returns void language plpgsql security definer as $$
declare
  v_plan_id uuid;
  v_total integer;
  v_completed integer;
  v_failed integer;
  v_outcome text := 'yes';
  v_reason text;
begin
  select id into v_plan_id from public.goal_plans where goal_id = p_goal_id and status = 'approved' order by created_at desc limit 1;
  if v_plan_id is null then
    return;
  end if;

  select count(*), count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_total, v_completed, v_failed
  from public.goal_plan_steps where plan_id = v_plan_id;

  if v_total > 0 and v_completed = v_total then
    update public.goal_plans set status = 'completed' where id = v_plan_id;
    update public.organization_goals set status = 'completed' where id = p_goal_id;
    v_reason := format('All %s plan steps completed; goal marked completed', v_total);
  elsif v_failed > 0 then
    v_outcome := 'no';
    v_reason := format('%s of %s steps failed; goal is at risk', v_failed, v_total);
  else
    v_reason := format('%s of %s steps completed; on track', v_completed, v_total);
  end if;

  perform public.log_decision(
    p_manager_agent_id, null, null, 'monitor_progress', v_outcome, v_reason,
    jsonb_build_object('goal_id', p_goal_id, 'plan_id', v_plan_id),
    jsonb_build_object('total_steps', v_total, 'completed_steps', v_completed, 'failed_steps', v_failed)
  );
end;
$$;

-- Orchestrator: generate tasks for newly-ready steps, assign them, and
-- refresh progress. Called after plan approval and reactively whenever a
-- plan-linked task completes or fails (see trigger below).
create or replace function public.run_goal_manager_cycle_core(p_goal_id uuid)
returns void language plpgsql security definer as $$
declare
  v_goal public.organization_goals%rowtype;
  v_step record;
  v_task_id uuid;
begin
  select * into v_goal from public.organization_goals where id = p_goal_id;
  if v_goal.id is null then
    raise exception 'goal not found';
  end if;
  if v_goal.manager_agent_id is null then
    raise exception 'goal has no manager agent assigned';
  end if;
  if v_goal.status <> 'active' or v_goal.is_paused then
    return;
  end if;

  for v_step in
    select s.id from public.goal_plan_steps s
    join public.goal_plans p on p.id = s.plan_id
    where p.goal_id = p_goal_id and p.status = 'approved' and s.status = 'pending' and s.task_id is null
      and not exists (
        select 1 from public.goal_plan_step_dependencies d
        join public.goal_plan_steps dep on dep.id = d.depends_on_step_id
        where d.step_id = s.id and dep.status <> 'completed'
      )
    order by s.step_order
  loop
    v_task_id := public.create_task_for_goal_plan_step(v_step.id);
    perform public.assign_best_agent_for_task(v_task_id, v_goal.manager_agent_id);
  end loop;

  perform public.monitor_goal_progress(p_goal_id, v_goal.manager_agent_id);
end;
$$;

create or replace function public.run_goal_manager_cycle(p_goal_id uuid)
returns void language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_manager_agent_id uuid;
begin
  select organization_id, manager_agent_id into v_org_id, v_manager_agent_id from public.organization_goals where id = p_goal_id;
  if v_org_id is null then
    raise exception 'goal not found';
  end if;
  if not (
    public.is_org_supervisor(v_org_id, auth.uid())
    or exists (select 1 from public.agents where id = v_manager_agent_id and owner_id = auth.uid())
  ) then
    raise exception 'not authorized';
  end if;

  perform public.run_goal_manager_cycle_core(p_goal_id);
end;
$$;

-- Reactive step: when a plan-linked task reaches a terminal state, update
-- the step and re-run the goal's manager cycle immediately (a completion
-- means dependents may now be ready; a failure gets escalated). Wrapped so
-- a manager-cycle error never blocks the task's own status update.
create or replace function public.trg_tasks_after_update_goal_step()
returns trigger language plpgsql security definer as $$
declare
  v_goal_id uuid;
  v_manager_agent_id uuid;
begin
  if new.goal_plan_step_id is not null and new.status in ('completed', 'failed') and old.status not in ('completed', 'failed') then
    update public.goal_plan_steps set status = new.status where id = new.goal_plan_step_id;

    select p.goal_id, g.manager_agent_id into v_goal_id, v_manager_agent_id
    from public.goal_plan_steps s
    join public.goal_plans p on p.id = s.plan_id
    join public.organization_goals g on g.id = p.goal_id
    where s.id = new.goal_plan_step_id;

    begin
      if new.status = 'failed' and v_manager_agent_id is not null then
        perform public.escalate_task_failure(new.id, v_manager_agent_id);
      end if;
      if v_goal_id is not null then
        perform public.run_goal_manager_cycle_core(v_goal_id);
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_after_update_goal_step on public.tasks;
create trigger tasks_after_update_goal_step after update of status on public.tasks
  for each row execute procedure public.trg_tasks_after_update_goal_step();

-- ============================================================
-- 8. PLAN APPROVAL / REJECTION (human override)
-- ============================================================
create or replace function public.approve_goal_plan(p_plan_id uuid)
returns public.goal_plans language plpgsql security definer as $$
declare
  v_goal_id uuid;
  v_org_id uuid;
  v_plan public.goal_plans%rowtype;
begin
  select goal_id into v_goal_id from public.goal_plans where id = p_plan_id;
  select organization_id into v_org_id from public.organization_goals where id = v_goal_id;
  if v_org_id is null or not public.is_org_manager(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.goal_plans set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_plan_id returning * into v_plan;

  update public.organization_goals set status = 'active' where id = v_goal_id and status = 'draft';

  perform public.run_goal_manager_cycle_core(v_goal_id);

  return v_plan;
end;
$$;

create or replace function public.reject_goal_plan(p_plan_id uuid)
returns public.goal_plans language plpgsql security definer as $$
declare
  v_goal_id uuid;
  v_org_id uuid;
  v_plan public.goal_plans%rowtype;
begin
  select goal_id into v_goal_id from public.goal_plans where id = p_plan_id;
  select organization_id into v_org_id from public.organization_goals where id = v_goal_id;
  if v_org_id is null or not public.is_org_manager(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.goal_plans set status = 'rejected' where id = p_plan_id returning * into v_plan;
  return v_plan;
end;
$$;

-- ============================================================
-- 9. RLS
-- ============================================================
-- Goals are internal operating data (like tasks), not public profile
-- content — visible to organization members, not the general public.
alter table public.organization_goals enable row level security;
alter table public.goal_plans enable row level security;
alter table public.goal_plan_steps enable row level security;
alter table public.goal_plan_step_dependencies enable row level security;

create policy "organization_goals_select" on public.organization_goals for select
  using (public.is_org_member(organization_id, auth.uid()));
create policy "organization_goals_insert" on public.organization_goals for insert
  with check (public.is_org_supervisor(organization_id, auth.uid()));
create policy "organization_goals_update" on public.organization_goals for update
  using (public.is_org_supervisor(organization_id, auth.uid()));
create policy "organization_goals_delete" on public.organization_goals for delete
  using (public.is_org_manager(organization_id, auth.uid()));

create policy "goal_plans_select" on public.goal_plans for select
  using (exists (select 1 from public.organization_goals g where g.id = goal_id and public.is_org_member(g.organization_id, auth.uid())));
create policy "goal_plans_insert" on public.goal_plans for insert
  with check (exists (select 1 from public.organization_goals g where g.id = goal_id and public.is_org_supervisor(g.organization_id, auth.uid())));
create policy "goal_plans_update" on public.goal_plans for update
  using (
    status = 'draft'
    and exists (select 1 from public.organization_goals g where g.id = goal_id and public.is_org_supervisor(g.organization_id, auth.uid()))
  );
-- Approval/rejection happen exclusively through approve_goal_plan()/
-- reject_goal_plan() (security definer, manager-only) — no update policy
-- covers those transitions directly.

create policy "goal_plan_steps_select" on public.goal_plan_steps for select
  using (exists (
    select 1 from public.goal_plans p join public.organization_goals g on g.id = p.goal_id
    where p.id = plan_id and public.is_org_member(g.organization_id, auth.uid())
  ));
create policy "goal_plan_steps_insert" on public.goal_plan_steps for insert
  with check (exists (
    select 1 from public.goal_plans p join public.organization_goals g on g.id = p.goal_id
    where p.id = plan_id and p.status = 'draft' and public.is_org_supervisor(g.organization_id, auth.uid())
  ));
create policy "goal_plan_steps_update" on public.goal_plan_steps for update
  using (exists (
    select 1 from public.goal_plans p join public.organization_goals g on g.id = p.goal_id
    where p.id = plan_id and p.status = 'draft' and public.is_org_supervisor(g.organization_id, auth.uid())
  ));
create policy "goal_plan_steps_delete" on public.goal_plan_steps for delete
  using (exists (
    select 1 from public.goal_plans p join public.organization_goals g on g.id = p.goal_id
    where p.id = plan_id and p.status = 'draft' and public.is_org_supervisor(g.organization_id, auth.uid())
  ));

create policy "goal_plan_step_deps_select" on public.goal_plan_step_dependencies for select
  using (exists (
    select 1 from public.goal_plan_steps s
    join public.goal_plans p on p.id = s.plan_id join public.organization_goals g on g.id = p.goal_id
    where s.id = step_id and public.is_org_member(g.organization_id, auth.uid())
  ));
create policy "goal_plan_step_deps_insert" on public.goal_plan_step_dependencies for insert
  with check (exists (
    select 1 from public.goal_plan_steps s
    join public.goal_plans p on p.id = s.plan_id join public.organization_goals g on g.id = p.goal_id
    where s.id = step_id and p.status = 'draft' and public.is_org_supervisor(g.organization_id, auth.uid())
  ));
create policy "goal_plan_step_deps_delete" on public.goal_plan_step_dependencies for delete
  using (exists (
    select 1 from public.goal_plan_steps s
    join public.goal_plans p on p.id = s.plan_id join public.organization_goals g on g.id = p.goal_id
    where s.id = step_id and p.status = 'draft' and public.is_org_supervisor(g.organization_id, auth.uid())
  ));

-- ============================================================
-- 10. SECURITY HARDENING (same rationale as migration 007, section 9)
-- ============================================================
revoke execute on function public.log_organization_activity(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.recompute_organization_state(uuid) from public, anon, authenticated;
revoke execute on function public.compute_organization_risk_score(uuid) from public, anon, authenticated;
revoke execute on function public.log_decision(uuid, uuid, uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.create_task_for_goal_plan_step(uuid) from public, anon, authenticated;
revoke execute on function public.assign_best_agent_for_task(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.escalate_task_failure(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.monitor_goal_progress(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.run_goal_manager_cycle_core(uuid) from public, anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.organization_goals;
alter publication supabase_realtime add table public.goal_plans;
alter publication supabase_realtime add table public.goal_plan_steps;

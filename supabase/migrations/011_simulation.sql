-- ============================================================
-- Simulation, Validation & Autonomy Layer (Phase 8)
-- Validates the AI Workforce Network under real operating conditions.
-- This is NOT a new platform feature: it seeds real rows through the
-- REAL autonomous machinery already built in Phases 3-7 (deploy_workforce_template,
-- approve_goal_plan, start_workflow_run, the reactive task/workflow/goal
-- triggers, the decision engine) and observes what actually happens.
-- No mock business data is fabricated — simulated tasks are clearly
-- marked (output->>'simulated') and their outcomes are decided by a real
-- probability model derived from each agent's real trust_score.
-- ============================================================

-- ============================================================
-- 1. SCHEMA
-- ============================================================
create table if not exists public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  target_agents integer not null,
  target_organizations integer not null,
  target_tasks integer not null,
  target_goals integer not null,
  target_workflows integer not null,
  actual_agents integer not null default 0,
  actual_organizations integer not null default 0,
  actual_tasks integer not null default 0,
  actual_goals integer not null default 0,
  actual_workflows integer not null default 0,
  -- Every organization this run deployed/topped-up, fixed once seeding
  -- finishes. This is how every later query scopes "this run's world"
  -- without needing a new tagging column on tasks/agents/goals/workflows.
  organization_ids uuid[] not null default '{}',
  triggered_by uuid references public.profiles(id) on delete set null,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer generated always as (
    case when completed_at is not null then greatest(0, extract(epoch from (completed_at - started_at))::integer) else null end
  ) stored,
  created_at timestamptz not null default now()
);
create index if not exists simulation_runs_status_idx on public.simulation_runs (status, created_at desc);

create table if not exists public.simulation_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.simulation_runs(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists simulation_events_run_id_idx on public.simulation_events (run_id, created_at);
create index if not exists simulation_events_entity_idx on public.simulation_events (entity_type, entity_id);

create table if not exists public.simulation_metrics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.simulation_runs(id) on delete cascade,
  metric_name text not null,
  metric_value numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, metric_name)
);
create index if not exists simulation_metrics_run_id_idx on public.simulation_metrics (run_id);

create table if not exists public.system_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('daily', 'weekly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  generated_by uuid references public.profiles(id) on delete set null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists system_reports_type_idx on public.system_reports (report_type, created_at desc);

-- Admin-only across the board: simulation runs and system reports are an
-- operations/observability surface, not something individual org owners
-- browse (matching the existing /admin/verifications precedent).
alter table public.simulation_runs enable row level security;
create policy "simulation_runs_select" on public.simulation_runs for select using (public.is_admin());
alter table public.simulation_events enable row level security;
create policy "simulation_events_select" on public.simulation_events for select using (public.is_admin());
alter table public.simulation_metrics enable row level security;
create policy "simulation_metrics_select" on public.simulation_metrics for select using (public.is_admin());
alter table public.system_reports enable row level security;
create policy "system_reports_select" on public.system_reports for select using (public.is_admin());
-- No direct write policies anywhere above: only the security-definer
-- functions below (all internally is_admin()-gated) ever write these rows.

-- ============================================================
-- 2. SIMULATION LOGGING HELPERS
-- ============================================================
create or replace function public.simulation_log_event(
  p_run_id uuid, p_event_type text, p_entity_type text, p_entity_id uuid default null, p_payload jsonb default '{}'::jsonb
)
returns void language plpgsql security definer as $$
begin
  insert into public.simulation_events (run_id, event_type, entity_type, entity_id, payload)
  values (p_run_id, p_event_type, p_entity_type, p_entity_id, p_payload);
end;
$$;

create or replace function public.simulation_record_metric(
  p_run_id uuid, p_metric_name text, p_metric_value numeric, p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer as $$
begin
  insert into public.simulation_metrics (run_id, metric_name, metric_value, metadata)
  values (p_run_id, p_metric_name, p_metric_value, p_metadata)
  on conflict (run_id, metric_name) do update set
    metric_value = excluded.metric_value, metadata = excluded.metadata, created_at = now();
end;
$$;

-- ============================================================
-- 3. TASK RESOLUTION ENGINE
-- ============================================================
-- Resolves one open task through the REAL decision engine: assigns an
-- agent if needed (from the org's real active assignments), occasionally
-- simulates a delegation (exercising the real delegation-acceptance
-- cascade), then transitions the task through in_progress into a
-- completed/failed outcome whose probability is derived from the
-- assigned agent's real trust_score — not a coin flip independent of the
-- system's own state.
create or replace function public.simulate_task_resolution(p_task_id uuid, p_run_id uuid)
returns void language plpgsql security definer as $$
declare
  v_task public.tasks%rowtype;
  v_agent public.agents%rowtype;
  v_org_id uuid;
  v_candidate_agent_id uuid;
  v_delegate_to uuid;
  v_delegation_id uuid;
  v_execution_id uuid;
  v_success_prob numeric;
  v_outcome text;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null or v_task.status in ('completed', 'failed') then
    return;
  end if;
  v_org_id := v_task.organization_id;

  if v_task.assigned_agent_id is null then
    select aa.agent_id into v_candidate_agent_id
    from public.agent_assignments aa
    join public.agents a on a.id = aa.agent_id
    where aa.organization_id = v_org_id and aa.status = 'active' and a.status = 'active'
      and (v_task.department_id is null or aa.department_id = v_task.department_id)
    order by random() limit 1;

    if v_candidate_agent_id is null then
      -- No agent to assign: fail the task outright rather than leaving it
      -- pending, so the run-loop's "pick the oldest open task" query never
      -- re-selects this same unassignable task on every remaining iteration.
      update public.tasks set status = 'failed', result_summary = 'No active agent available for assignment' where id = p_task_id;
      perform public.simulation_log_event(p_run_id, 'task_assignment_failed', 'task', p_task_id, jsonb_build_object('reason', 'no active agent available in organization/department'));
      return;
    end if;

    update public.tasks set assigned_agent_id = v_candidate_agent_id where id = p_task_id;
    v_task.assigned_agent_id := v_candidate_agent_id;
  end if;

  -- Occasionally simulate load-balancing delegation instead of direct
  -- resolution. Inserted as 'pending' then updated to 'accepted' (rather
  -- than inserted directly as accepted) so the real
  -- trg_delegations_after_update reassignment cascade actually fires —
  -- it only triggers on UPDATE.
  if random() < 0.1 then
    select aa.agent_id into v_delegate_to
    from public.agent_assignments aa
    join public.agents a on a.id = aa.agent_id
    where aa.organization_id = v_org_id and aa.status = 'active' and a.status = 'active'
      and aa.agent_id <> v_task.assigned_agent_id
    order by random() limit 1;

    if v_delegate_to is not null then
      insert into public.delegations (task_id, from_agent_id, to_agent_id, reason, status)
      values (p_task_id, v_task.assigned_agent_id, v_delegate_to, 'simulated load-balancing delegation', 'pending')
      returning id into v_delegation_id;

      update public.delegations set status = 'accepted' where id = v_delegation_id;

      perform public.simulation_log_event(
        p_run_id, 'delegation', 'delegation', v_delegation_id,
        jsonb_build_object('task_id', p_task_id, 'from_agent_id', v_task.assigned_agent_id, 'to_agent_id', v_delegate_to)
      );

      v_task.assigned_agent_id := v_delegate_to;
    end if;
  end if;

  select * into v_agent from public.agents where id = v_task.assigned_agent_id;
  v_success_prob := least(0.95, greatest(0.4, 0.5 + (coalesce(v_agent.trust_score, 50) - 50) / 150.0));

  perform public.decide_agent_accept_task(v_agent.id, p_task_id);

  insert into public.agent_executions (agent_id, task_id, status, input, started_at)
  values (v_agent.id, p_task_id, 'running', jsonb_build_object('simulated', true, 'task_title', v_task.title, 'run_id', p_run_id), now())
  returning id into v_execution_id;

  update public.tasks set status = 'in_progress' where id = p_task_id;

  if random() < v_success_prob then
    v_outcome := 'completed';
    update public.agent_executions set status = 'completed', output = jsonb_build_object('simulated', true, 'result', 'success'), completed_at = now() where id = v_execution_id;
    perform public.decide_agent_complete_task(v_agent.id, p_task_id, v_execution_id);
    update public.tasks set status = 'completed', result_summary = 'Simulated completion', output = jsonb_build_object('simulated', true) where id = p_task_id;
  else
    v_outcome := 'failed';
    update public.agent_executions set status = 'failed', error = 'simulated failure', completed_at = now() where id = v_execution_id;
    update public.tasks set status = 'failed', result_summary = 'Simulated failure' where id = p_task_id;
  end if;

  perform public.simulation_log_event(
    p_run_id, 'task_resolved', 'task', p_task_id,
    jsonb_build_object('outcome', v_outcome, 'agent_id', v_agent.id, 'success_probability', round(v_success_prob, 4))
  );
end;
$$;

-- ============================================================
-- 4. SEEDING + RUN ENGINE
-- ============================================================
-- Deploys real organizations from the existing workforce templates
-- (cycling through them to hit the organization target), tops up
-- agents/goals/workflows to their exact targets via direct creation when
-- the templates alone don't multiply out evenly, then drives every open
-- task to resolution (padding with standalone tasks if still short of
-- the task target). Every step reuses an existing Phase 3-7 RPC —
-- deploy_workforce_template, approve_goal_plan, start_workflow_run — so
-- the exact same triggers and cascades a human-run organization would
-- exercise are the ones exercised here.
create or replace function public.start_simulation_run(
  p_target_agents integer default 100,
  p_target_organizations integer default 20,
  p_target_tasks integer default 1000,
  p_target_goals integer default 100,
  p_target_workflows integer default 50,
  p_max_iterations integer default 5000
)
returns public.simulation_runs language plpgsql security definer as $$
declare
  v_run public.simulation_runs;
  v_run_id uuid;
  v_template_ids uuid[];
  v_template_count integer;
  v_template_id uuid;
  v_template_name text;
  v_template_industry text;
  v_org_ids uuid[] := '{}';
  v_new_org_id uuid;
  v_org_name text;
  v_agent_count integer;
  v_goal_count integer;
  v_workflow_count integer;
  v_task_count integer;
  v_new_agent_id uuid;
  v_random_org uuid;
  v_manager_agent_id uuid;
  v_goal_id uuid;
  v_plan_id uuid;
  v_step_agent_id uuid;
  v_wf_id uuid;
  v_task_id uuid;
  v_iterations integer := 0;
  v_topup_n integer;
  i integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  v_template_ids := array(select id from public.workforce_templates order by created_at);
  v_template_count := coalesce(array_length(v_template_ids, 1), 0);
  if v_template_count = 0 then
    raise exception 'no workforce templates found — run the Phase 7 template seeds first';
  end if;

  insert into public.simulation_runs (
    status, target_agents, target_organizations, target_tasks, target_goals, target_workflows, triggered_by
  ) values (
    'running', p_target_agents, p_target_organizations, p_target_tasks, p_target_goals, p_target_workflows, auth.uid()
  ) returning id into v_run_id;

  begin
    -- --- Organizations: deploy real workforce templates, cycling through them ---
    for i in 1..p_target_organizations loop
      v_template_id := v_template_ids[((i - 1) % v_template_count) + 1];
      select name, industry into v_template_name, v_template_industry from public.workforce_templates where id = v_template_id;
      v_org_name := v_template_name || ' — Sim ' || i || '-' || substr(md5(random()::text), 1, 5);

      begin
        v_new_org_id := public.deploy_workforce_template(v_template_id, v_org_name, v_template_industry);
        v_org_ids := array_append(v_org_ids, v_new_org_id);
        perform public.simulation_log_event(v_run_id, 'organization_deployed', 'organization', v_new_org_id, jsonb_build_object('template_id', v_template_id, 'template_name', v_template_name));
      exception when others then
        perform public.log_failed_deployment(v_template_id, sqlerrm);
        perform public.simulation_log_event(v_run_id, 'organization_deployment_failed', 'template', v_template_id, jsonb_build_object('error', sqlerrm));
      end;
    end loop;

    if array_length(v_org_ids, 1) is null or array_length(v_org_ids, 1) = 0 then
      raise exception 'no organizations could be deployed';
    end if;

    update public.simulation_runs set organization_ids = v_org_ids where id = v_run_id;

    -- --- Activate every template-deployed workflow ---
    -- deploy_workforce_template intentionally leaves workflows in 'draft'
    -- (a human decides when to kick one off); a simulation run needs them
    -- actually running to validate anything, so start them all here.
    for v_wf_id in select id from public.workflows
      where organization_id = any(v_org_ids)
        and not exists (select 1 from public.workflow_runs where workflow_id = workflows.id)
    loop
      begin
        perform public.start_workflow_run(v_wf_id);
        perform public.simulation_log_event(v_run_id, 'workflow_activated', 'workflow', v_wf_id, '{}'::jsonb);
      exception when others then
        perform public.simulation_log_event(v_run_id, 'workflow_start_failed', 'workflow', v_wf_id, jsonb_build_object('error', sqlerrm));
      end;
    end loop;

    -- --- Activate every template-deployed goal ---
    -- Likewise, deploy_workforce_template leaves goals planless (a human
    -- or the real AI planner authors the actual plan); this simulation has
    -- no LLM credentials to call the real planner, so it drafts the same
    -- simple synthetic single-step plan the topup path below uses and
    -- approves it, so every deployed goal actually runs.
    for v_goal_id in select id from public.organization_goals
      where organization_id = any(v_org_ids)
        and not exists (select 1 from public.goal_plans where goal_id = organization_goals.id)
    loop
      insert into public.goal_plans (goal_id, status, generated_by, created_by) values (v_goal_id, 'draft', 'ai', auth.uid()) returning id into v_plan_id;
      insert into public.goal_plan_steps (plan_id, step_order, title, description) values (v_plan_id, 1, 'Execute goal', 'Auto-generated single-step plan for simulation');

      begin
        perform public.approve_goal_plan(v_plan_id);
        perform public.simulation_log_event(v_run_id, 'goal_plan_activated', 'goal', v_goal_id, '{}'::jsonb);
      exception when others then
        perform public.simulation_log_event(v_run_id, 'goal_approval_failed', 'goal', v_goal_id, jsonb_build_object('error', sqlerrm));
      end;
    end loop;

    -- --- Agents: top up to the exact target ---
    select count(distinct agent_id) into v_agent_count from public.agent_assignments
    where organization_id = any(v_org_ids) and status <> 'removed';

    v_topup_n := 0;
    while v_agent_count < p_target_agents loop
      v_topup_n := v_topup_n + 1;
      insert into public.agents (owner_id, name, description, status)
      values (auth.uid(), 'Simulated Agent ' || v_topup_n, 'Synthetic agent added by the simulation engine to reach target headcount', 'active')
      returning id into v_new_agent_id;

      v_random_org := v_org_ids[1 + floor(random() * array_length(v_org_ids, 1))::int];
      insert into public.agent_assignments (agent_id, organization_id, assigned_by) values (v_new_agent_id, v_random_org, auth.uid());

      perform public.simulation_log_event(v_run_id, 'agent_created_topup', 'agent', v_new_agent_id, jsonb_build_object('organization_id', v_random_org));
      v_agent_count := v_agent_count + 1;
    end loop;

    -- --- Workflows: top up to the exact target ---
    select count(*) into v_workflow_count from public.workflows where organization_id = any(v_org_ids);

    v_topup_n := 0;
    while v_workflow_count < p_target_workflows loop
      v_topup_n := v_topup_n + 1;
      v_random_org := v_org_ids[1 + floor(random() * array_length(v_org_ids, 1))::int];

      select agent_id into v_step_agent_id from public.agent_assignments
      where organization_id = v_random_org and status = 'active' order by random() limit 1;

      insert into public.workflows (organization_id, name, description, status, created_by)
      values (v_random_org, 'Simulated Workflow ' || v_topup_n, 'Synthetic workflow added by the simulation engine', 'active', auth.uid())
      returning id into v_wf_id;

      insert into public.workflow_steps (workflow_id, step_order, name, agent_id) values (v_wf_id, 1, 'Simulated Step 1', v_step_agent_id);
      insert into public.workflow_steps (workflow_id, step_order, name, agent_id) values (v_wf_id, 2, 'Simulated Step 2', v_step_agent_id);

      begin
        perform public.start_workflow_run(v_wf_id);
        perform public.simulation_log_event(v_run_id, 'workflow_created_topup', 'workflow', v_wf_id, jsonb_build_object('organization_id', v_random_org));
      exception when others then
        perform public.simulation_log_event(v_run_id, 'workflow_start_failed', 'workflow', v_wf_id, jsonb_build_object('error', sqlerrm));
      end;

      v_workflow_count := v_workflow_count + 1;
    end loop;

    -- --- Goals: top up to the exact target ---
    select count(*) into v_goal_count from public.organization_goals where organization_id = any(v_org_ids);

    v_topup_n := 0;
    while v_goal_count < p_target_goals loop
      v_topup_n := v_topup_n + 1;
      v_random_org := v_org_ids[1 + floor(random() * array_length(v_org_ids, 1))::int];

      select agent_id into v_manager_agent_id from public.agent_assignments
      where organization_id = v_random_org and status = 'active' order by random() limit 1;

      if v_manager_agent_id is null then
        exit;
      end if;

      insert into public.organization_goals (organization_id, title, description, priority, manager_agent_id, created_by, status)
      values (v_random_org, 'Simulated Goal ' || v_topup_n, 'Synthetic goal added by the simulation engine to reach target volume', 'medium', v_manager_agent_id, auth.uid(), 'draft')
      returning id into v_goal_id;

      insert into public.goal_plans (goal_id, status, generated_by, created_by) values (v_goal_id, 'draft', 'ai', auth.uid()) returning id into v_plan_id;
      insert into public.goal_plan_steps (plan_id, step_order, title, description) values (v_plan_id, 1, 'Execute simulated goal', 'Auto-generated single-step plan for simulation');

      begin
        perform public.approve_goal_plan(v_plan_id);
        perform public.simulation_log_event(v_run_id, 'goal_created_topup', 'goal', v_goal_id, jsonb_build_object('organization_id', v_random_org));
      exception when others then
        perform public.simulation_log_event(v_run_id, 'goal_approval_failed', 'goal', v_goal_id, jsonb_build_object('error', sqlerrm));
      end;

      v_goal_count := v_goal_count + 1;
    end loop;

    -- --- Tasks: resolve everything the above generated, padding up to target ---
    loop
      exit when v_iterations >= p_max_iterations;

      select id into v_task_id from public.tasks
      where organization_id = any(v_org_ids) and status not in ('completed', 'failed')
      order by created_at limit 1;

      if v_task_id is null then
        select count(*) into v_task_count from public.tasks where organization_id = any(v_org_ids);
        exit when v_task_count >= p_target_tasks;

        v_random_org := v_org_ids[1 + floor(random() * array_length(v_org_ids, 1))::int];
        insert into public.tasks (title, organization_id, created_by, priority)
        values ('Simulated Workload Task ' || (v_task_count + 1), v_random_org, auth.uid(), (array['low', 'medium', 'high'])[1 + floor(random() * 3)::int])
        returning id into v_task_id;
        perform public.simulation_log_event(v_run_id, 'task_created_topup', 'task', v_task_id, jsonb_build_object('organization_id', v_random_org));
      end if;

      begin
        perform public.simulate_task_resolution(v_task_id, v_run_id);
      exception when others then
        perform public.simulation_log_event(v_run_id, 'task_resolution_error', 'task', v_task_id, jsonb_build_object('error', sqlerrm));
        update public.tasks set status = 'failed', result_summary = 'Simulation error: ' || sqlerrm where id = v_task_id and status not in ('completed', 'failed');
      end;

      v_iterations := v_iterations + 1;
    end loop;

    select count(distinct agent_id) into v_agent_count from public.agent_assignments where organization_id = any(v_org_ids) and status <> 'removed';
    select count(*) into v_goal_count from public.organization_goals where organization_id = any(v_org_ids);
    select count(*) into v_workflow_count from public.workflows where organization_id = any(v_org_ids);
    select count(*) into v_task_count from public.tasks where organization_id = any(v_org_ids);

    update public.simulation_runs set
      status = 'completed',
      actual_organizations = array_length(v_org_ids, 1),
      actual_agents = v_agent_count,
      actual_goals = v_goal_count,
      actual_workflows = v_workflow_count,
      actual_tasks = v_task_count,
      completed_at = now()
    where id = v_run_id returning * into v_run;

    perform public.compute_run_metrics(v_run_id);

    return v_run;
  exception when others then
    update public.simulation_runs set status = 'failed', error = sqlerrm, completed_at = now() where id = v_run_id returning * into v_run;
    return v_run;
  end;
end;
$$;

-- ============================================================
-- 5. ORGANIZATION STRESS-TEST METRICS (per run)
-- ============================================================
create or replace function public.compute_run_metrics(p_run_id uuid)
returns void language plpgsql security definer as $$
declare
  v_org_ids uuid[];
  v_total_tasks integer;
  v_completed_tasks integer;
  v_failed_tasks integer;
  v_total_runs integer;
  v_completed_runs integer;
  v_delegation_count integer;
  v_avg_agent_utilization numeric;
  v_total_decisions integer;
  v_positive_decisions integer;
  v_total_goals integer;
  v_completed_goals integer;
  v_failed_goals integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select organization_ids into v_org_ids from public.simulation_runs where id = p_run_id;
  if v_org_ids is null or array_length(v_org_ids, 1) is null then
    return;
  end if;

  select count(*), count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_total_tasks, v_completed_tasks, v_failed_tasks
  from public.tasks where organization_id = any(v_org_ids);

  perform public.simulation_record_metric(p_run_id, 'task_completion_rate', case when v_total_tasks > 0 then round(v_completed_tasks::numeric / v_total_tasks * 100, 2) else 0 end);
  perform public.simulation_record_metric(p_run_id, 'task_failure_rate', case when v_total_tasks > 0 then round(v_failed_tasks::numeric / v_total_tasks * 100, 2) else 0 end);

  select count(*), count(*) filter (where status = 'completed') into v_total_runs, v_completed_runs
  from public.workflow_runs where organization_id = any(v_org_ids);
  perform public.simulation_record_metric(p_run_id, 'workflow_completion_rate', case when v_total_runs > 0 then round(v_completed_runs::numeric / v_total_runs * 100, 2) else 0 end);

  select count(*) into v_delegation_count from public.delegations d
  join public.tasks t on t.id = d.task_id where t.organization_id = any(v_org_ids);
  perform public.simulation_record_metric(p_run_id, 'delegation_frequency', case when v_total_tasks > 0 then round(v_delegation_count::numeric / v_total_tasks * 100, 2) else 0 end);

  select avg(agent_utilization) into v_avg_agent_utilization from public.organization_state where organization_id = any(v_org_ids);
  perform public.simulation_record_metric(p_run_id, 'avg_agent_utilization', coalesce(round(v_avg_agent_utilization, 2), 0));

  select count(*), count(*) filter (where outcome = 'yes') into v_total_decisions, v_positive_decisions
  from public.agent_decisions ad
  where exists (select 1 from public.agent_assignments aa where aa.agent_id = ad.agent_id and aa.organization_id = any(v_org_ids));
  perform public.simulation_record_metric(p_run_id, 'manager_decision_quality', case when v_total_decisions > 0 then round(v_positive_decisions::numeric / v_total_decisions * 100, 2) else 0 end);

  select count(*), count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_total_goals, v_completed_goals, v_failed_goals
  from public.organization_goals where organization_id = any(v_org_ids);
  perform public.simulation_record_metric(p_run_id, 'goal_completion_rate', case when (v_completed_goals + v_failed_goals) > 0 then round(v_completed_goals::numeric / (v_completed_goals + v_failed_goals) * 100, 2) else 0 end);
end;
$$;

-- ============================================================
-- 6. NETWORK HEALTH (global, platform-wide, admin-only)
-- ============================================================
create or replace function public.get_network_health()
returns table (
  active_organizations bigint,
  active_agents bigint,
  task_throughput_24h bigint,
  goal_completion_rate numeric,
  avg_runtime_seconds numeric,
  failure_rate numeric
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    (select count(distinct organization_id) from public.agent_assignments where status = 'active'),
    (select count(*) from public.agents where status = 'active'),
    (select count(*) from public.tasks where status in ('completed', 'failed') and updated_at > now() - interval '24 hours'),
    (select case when count(*) filter (where status in ('completed', 'failed')) > 0
       then round(count(*) filter (where status = 'completed')::numeric / count(*) filter (where status in ('completed', 'failed')) * 100, 2)
       else 0 end
     from public.organization_goals),
    (select coalesce(round(avg(execution_time_seconds), 2), 0) from public.tasks where execution_time_seconds is not null),
    (select case when count(*) > 0 then round(count(*) filter (where status = 'failed')::numeric / count(*) * 100, 2) else 0 end
     from public.tasks where status in ('completed', 'failed'));
end;
$$;

-- ============================================================
-- 7. BOTTLENECK ANALYSIS (global, admin-only)
-- ============================================================
create or replace function public.find_overloaded_agents(p_limit integer default 20)
returns table (agent_id uuid, agent_name text, live_task_count bigint, trust_score numeric)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select a.id, a.name, count(t.id), a.trust_score
  from public.agents a
  join public.tasks t on t.assigned_agent_id = a.id and t.status in ('assigned', 'in_progress')
  group by a.id, a.name, a.trust_score
  having count(t.id) >= 3
  order by count(t.id) desc
  limit p_limit;
end;
$$;

create or replace function public.find_idle_agents(p_limit integer default 20)
returns table (agent_id uuid, agent_name text, last_active_at timestamptz, trust_score numeric)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select a.id, a.name, pm.last_active_at, a.trust_score
  from public.agents a
  left join public.agent_performance_metrics pm on pm.agent_id = a.id
  where a.status = 'active'
    and (pm.last_active_at is null or pm.last_active_at < now() - interval '7 days')
  order by pm.last_active_at asc nulls first
  limit p_limit;
end;
$$;

create or replace function public.find_workflow_deadlocks(p_limit integer default 20)
returns table (workflow_run_id uuid, workflow_id uuid, organization_id uuid, current_step_order integer, stalled_since timestamptz)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select r.id, r.workflow_id, r.organization_id, r.current_step_order, wsr.started_at
  from public.workflow_runs r
  join public.workflow_steps s on s.workflow_id = r.workflow_id and s.step_order = r.current_step_order
  join public.workflow_step_runs wsr on wsr.workflow_run_id = r.id and wsr.workflow_step_id = s.id
  where r.status = 'in_progress' and wsr.status = 'in_progress' and wsr.started_at < now() - interval '1 hour'
  order by wsr.started_at asc
  limit p_limit;
end;
$$;

create or replace function public.find_stuck_goals(p_limit integer default 20)
returns table (goal_id uuid, organization_id uuid, title text, updated_at timestamptz, is_paused boolean)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select g.id, g.organization_id, g.title, g.updated_at, g.is_paused
  from public.organization_goals g
  where g.status = 'active'
    and (g.is_paused or g.updated_at < now() - interval '24 hours')
    and not exists (
      select 1 from public.goal_plan_steps s
      join public.goal_plans p on p.id = s.plan_id
      where p.goal_id = g.id and s.status = 'completed' and s.updated_at > now() - interval '24 hours'
    )
  order by g.updated_at asc
  limit p_limit;
end;
$$;

create or replace function public.find_task_assignment_failures(p_limit integer default 20)
returns table (task_id uuid, organization_id uuid, title text, created_at timestamptz)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select t.id, t.organization_id, t.title, t.created_at
  from public.tasks t
  where t.status = 'pending' and t.assigned_agent_id is null and t.created_at < now() - interval '1 hour'
  order by t.created_at asc
  limit p_limit;
end;
$$;

create or replace function public.find_trust_score_anomalies(p_limit integer default 20)
returns table (agent_id uuid, agent_name text, trust_score numeric, recent_failures bigint)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select a.id, a.name, a.trust_score, count(e.id)
  from public.agents a
  join public.agent_executions e on e.agent_id = a.id and e.status = 'failed' and e.created_at > now() - interval '24 hours'
  group by a.id, a.name, a.trust_score
  having count(e.id) >= 3 and a.trust_score > 60
  order by count(e.id) desc
  limit p_limit;
end;
$$;

-- ============================================================
-- 8. AUTONOMY SCORE (global, admin-only)
-- ============================================================
create or replace function public.compute_autonomy_score()
returns table (
  pct_tasks_auto_created numeric,
  pct_tasks_auto_completed numeric,
  pct_goals_autonomous numeric,
  pct_workflows_autonomous numeric,
  overall_score numeric
)
language plpgsql security definer stable as $$
declare
  v_total_tasks bigint;
  v_auto_created_tasks bigint;
  v_completed_tasks bigint;
  v_auto_completed_tasks bigint;
  v_completed_goals bigint;
  v_failed_goals bigint;
  v_completed_runs bigint;
  v_autonomous_runs bigint;
  v_a numeric; v_b numeric; v_c numeric; v_d numeric;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select count(*), count(*) filter (where workflow_step_id is not null or goal_plan_step_id is not null)
  into v_total_tasks, v_auto_created_tasks from public.tasks;
  v_a := case when v_total_tasks > 0 then round(v_auto_created_tasks::numeric / v_total_tasks * 100, 2) else 0 end;

  select count(*) into v_completed_tasks from public.tasks where status = 'completed';
  select count(distinct t.id) into v_auto_completed_tasks
  from public.tasks t
  join public.agent_executions e on e.task_id = t.id and e.status = 'completed'
  where t.status = 'completed';
  v_b := case when v_completed_tasks > 0 then round(v_auto_completed_tasks::numeric / v_completed_tasks * 100, 2) else 0 end;

  -- Goals can only ever reach 'completed' via the autonomous
  -- monitor_goal_progress() path (no UI exposes a direct human
  -- "mark completed" action) — this proxy is exact, not approximate.
  select count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_completed_goals, v_failed_goals from public.organization_goals;
  v_c := case when (v_completed_goals + v_failed_goals) > 0 then round(v_completed_goals::numeric / (v_completed_goals + v_failed_goals) * 100, 2) else 0 end;

  -- A completed run counts as autonomous when every task tied to it was
  -- completed via a linked successful execution (same proxy as tasks) —
  -- both the reactive advance and the manual "Complete Step" button call
  -- the same underlying function, so this is the only signal available
  -- to tell them apart.
  select count(*) into v_completed_runs from public.workflow_runs where status = 'completed';
  select count(*) into v_autonomous_runs
  from public.workflow_runs r
  where r.status = 'completed'
    and not exists (
      select 1 from public.tasks t
      where t.workflow_run_id = r.id and t.status = 'completed'
        and not exists (select 1 from public.agent_executions e where e.task_id = t.id and e.status = 'completed')
    );
  v_d := case when v_completed_runs > 0 then round(v_autonomous_runs::numeric / v_completed_runs * 100, 2) else 0 end;

  return query select v_a, v_b, v_c, v_d, round((v_a + v_b + v_c + v_d) / 4.0, 2);
end;
$$;

-- ============================================================
-- 9. EXECUTIVE REPORTING (global, admin-only)
-- ============================================================
create or replace function public.generate_system_report(p_report_type text default 'daily')
returns public.system_reports language plpgsql security definer as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz := now();
  v_top_orgs jsonb;
  v_top_agents jsonb;
  v_problem_areas jsonb;
  v_opportunities jsonb := '[]'::jsonb;
  v_overloaded_count integer;
  v_idle_count integer;
  v_stuck_goals_count integer;
  v_assignment_failures_count integer;
  v_health record;
  v_autonomy record;
  v_content jsonb;
  v_row public.system_reports;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_report_type not in ('daily', 'weekly') then
    raise exception 'report type must be daily or weekly';
  end if;

  v_period_start := case when p_report_type = 'daily' then v_period_end - interval '1 day' else v_period_end - interval '7 days' end;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_top_orgs from (
    select o.id as organization_id, o.name, m.success_rate, m.tasks_completed
    from public.organizations o
    join public.organization_metrics m on m.organization_id = o.id
    order by m.success_rate desc, m.tasks_completed desc
    limit 5
  ) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_top_agents from (
    select a.id as agent_id, a.name, a.trust_score, pm.tasks_completed
    from public.agents a
    left join public.agent_performance_metrics pm on pm.agent_id = a.id
    order by a.trust_score desc, pm.tasks_completed desc nulls last
    limit 5
  ) x;

  select count(*) into v_overloaded_count from public.find_overloaded_agents(1000);
  select count(*) into v_idle_count from public.find_idle_agents(1000);
  select count(*) into v_stuck_goals_count from public.find_stuck_goals(1000);
  select count(*) into v_assignment_failures_count from public.find_task_assignment_failures(1000);

  v_problem_areas := jsonb_build_object(
    'overloaded_agents', v_overloaded_count,
    'idle_agents', v_idle_count,
    'stuck_goals', v_stuck_goals_count,
    'task_assignment_failures', v_assignment_failures_count
  );

  if v_overloaded_count > 0 then
    v_opportunities := v_opportunities || jsonb_build_array(format('%s agent(s) are overloaded (3+ concurrent tasks) — consider assigning more agents to their departments.', v_overloaded_count));
  end if;
  if v_idle_count > 0 then
    v_opportunities := v_opportunities || jsonb_build_array(format('%s active agent(s) have been idle for 7+ days — consider reassigning them or reviewing their capabilities.', v_idle_count));
  end if;
  if v_stuck_goals_count > 0 then
    v_opportunities := v_opportunities || jsonb_build_array(format('%s goal(s) appear stuck or paused with no recent progress — review their plans.', v_stuck_goals_count));
  end if;
  if v_assignment_failures_count > 0 then
    v_opportunities := v_opportunities || jsonb_build_array(format('%s task(s) have gone unassigned for over an hour — department staffing may be insufficient.', v_assignment_failures_count));
  end if;

  select * into v_health from public.get_network_health();
  select * into v_autonomy from public.compute_autonomy_score();

  v_content := jsonb_build_object(
    'network_health', to_jsonb(v_health),
    'autonomy_score', to_jsonb(v_autonomy),
    'top_organizations', v_top_orgs,
    'top_agents', v_top_agents,
    'problem_areas', v_problem_areas,
    'optimization_opportunities', v_opportunities
  );

  insert into public.system_reports (report_type, period_start, period_end, generated_by, content)
  values (p_report_type, v_period_start, v_period_end, auth.uid(), v_content)
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- 10. SECURITY HARDENING
-- ============================================================
-- Internal-only helpers: never meant to be called directly via
-- supabase.rpc() by anything other than the run engine above.
revoke execute on function public.simulation_log_event(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.simulation_record_metric(uuid, text, numeric, jsonb) from public, anon, authenticated;
revoke execute on function public.simulate_task_resolution(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.compute_run_metrics(uuid) from public, anon, authenticated;

-- Public-callable (admin-gated internally): start_simulation_run,
-- get_network_health, find_*, compute_autonomy_score, and
-- generate_system_report all check public.is_admin() themselves — the
-- same pattern as grant_agent_verification (Phase 2) — so they stay
-- directly callable via supabase.rpc() by an authenticated admin user,
-- exactly as the /system-health page needs.

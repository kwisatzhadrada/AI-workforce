-- ============================================================
-- Workforce Intelligence Layer (Phase 9)
-- The network learns from its own operation: derived agent/organization/
-- workflow intelligence, predictions, and recommendations computed
-- entirely from data Phases 1-8 already produce. No new business-
-- transaction concepts (no marketplace, payments, crypto, hiring,
-- external clients, or new organization systems) — this phase only
-- observes, predicts, and (with human approval) helps optimize what
-- already exists.
-- ============================================================

-- ============================================================
-- 0. SMALL SHARED HELPERS
-- ============================================================
-- Ordinal rank of an assignment priority, for detecting promotions.
create or replace function public.priority_rank(p_priority text)
returns integer language sql immutable as $$
  select case p_priority when 'low' then 1 when 'medium' then 2 when 'high' then 3 when 'critical' then 4 else 0 end;
$$;

-- Append an element to a jsonb array, keeping only the most recent p_cap
-- entries — used by agent_careers' history arrays so they don't grow
-- unbounded over an agent's lifetime.
create or replace function public.jsonb_array_push_capped(p_arr jsonb, p_elem jsonb, p_cap integer)
returns jsonb language sql immutable as $$
  select case
    when jsonb_array_length(coalesce(p_arr, '[]'::jsonb) || jsonb_build_array(p_elem)) <= p_cap
    then coalesce(p_arr, '[]'::jsonb) || jsonb_build_array(p_elem)
    else (
      select jsonb_agg(e.value order by e.ordinality)
      from jsonb_array_elements(coalesce(p_arr, '[]'::jsonb) || jsonb_build_array(p_elem)) with ordinality as e(value, ordinality)
      where e.ordinality > jsonb_array_length(coalesce(p_arr, '[]'::jsonb) || jsonb_build_array(p_elem)) - p_cap
    )
  end;
$$;

-- ============================================================
-- 1. WORKFORCE INTELLIGENCE (generic insight/prediction/recommendation log)
-- ============================================================
create table if not exists public.workforce_insights (
  id uuid primary key default gen_random_uuid(),
  insight_type text not null,
  entity_type text not null check (entity_type in ('agent', 'organization', 'workflow', 'template', 'platform')),
  entity_id uuid,
  title text not null,
  detail text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workforce_insights_entity_idx on public.workforce_insights (entity_type, entity_id, created_at desc);
create index if not exists workforce_insights_type_idx on public.workforce_insights (insight_type, created_at desc);

create table if not exists public.workforce_predictions (
  id uuid primary key default gen_random_uuid(),
  prediction_type text not null check (prediction_type in (
    'task_success_probability', 'goal_success_probability', 'workflow_failure_probability',
    'agent_burnout_risk', 'organization_risk_score'
  )),
  entity_type text not null check (entity_type in ('task', 'goal', 'workflow', 'agent', 'organization')),
  entity_id uuid not null,
  predicted_value numeric not null,
  confidence numeric not null check (confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workforce_predictions_entity_idx on public.workforce_predictions (entity_type, entity_id, created_at desc);
create index if not exists workforce_predictions_type_idx on public.workforce_predictions (prediction_type, created_at desc);

create table if not exists public.workforce_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommendation_type text not null check (recommendation_type in (
    'reassign_agent', 'add_agent', 'replace_workflow_step', 'rebalance_load'
  )),
  entity_type text not null check (entity_type in ('agent', 'organization', 'workflow', 'workflow_step', 'department')),
  entity_id uuid not null,
  title text not null,
  reason text not null,
  expected_impact text not null,
  confidence_score numeric not null check (confidence_score between 0 and 1),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied')),
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists workforce_recommendations_status_idx on public.workforce_recommendations (status, created_at desc);
create index if not exists workforce_recommendations_entity_idx on public.workforce_recommendations (entity_type, entity_id);
-- One live (pending) recommendation per exact type+entity — reruns of the
-- generator shouldn't pile up duplicate pending suggestions.
create unique index if not exists workforce_recommendations_one_pending
  on public.workforce_recommendations (recommendation_type, entity_type, entity_id) where status = 'pending';

-- Operational/strategic data — admin-only, matching Phase 8's
-- simulation/system_reports precedent (not the public-profile precedent
-- agent/organization tables use below).
alter table public.workforce_insights enable row level security;
create policy "workforce_insights_select" on public.workforce_insights for select using (public.is_admin());
alter table public.workforce_predictions enable row level security;
create policy "workforce_predictions_select" on public.workforce_predictions for select using (public.is_admin());
alter table public.workforce_recommendations enable row level security;
create policy "workforce_recommendations_select" on public.workforce_recommendations for select using (public.is_admin());
-- No direct write policies: only the security-definer functions below write these.

-- ============================================================
-- 2. AGENT INTELLIGENCE
-- ============================================================
-- Public, same visibility precedent as agents/agent_performance_metrics/
-- trust_score (Phase 1-2's "public professional network" posture) — this
-- is a deeper derived view of the same already-public signals.
create table if not exists public.agent_profiles_intelligence (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  specializations text[] not null default '{}',
  risk_factors text[] not null default '{}',
  growth_trend text not null default 'insufficient_data' check (growth_trend in ('improving', 'declining', 'stable', 'insufficient_data')),
  goal_contribution_count integer not null default 0,
  workflow_success_rate numeric(5,2),
  delegation_effectiveness numeric(5,2),
  updated_at timestamptz not null default now()
);
alter table public.agent_profiles_intelligence enable row level security;
create policy "agent_profiles_intelligence_select" on public.agent_profiles_intelligence for select using (true);

-- Recomputes everything in agent_profiles_intelligence from first
-- principles each call — cheap enough at today's scale (see README on
-- scaling this to 1M+ agents via batched/materialized refresh instead).
create or replace function public.recompute_agent_intelligence(p_agent_id uuid)
returns void language plpgsql security definer as $$
declare
  v_overall_success numeric;
  v_overall_total integer;
  v_recent_completed integer;
  v_recent_failed integer;
  v_recent_rate numeric;
  v_prior_completed integer;
  v_prior_failed integer;
  v_prior_rate numeric;
  v_growth_trend text := 'insufficient_data';
  v_strengths text[] := '{}';
  v_weaknesses text[] := '{}';
  v_specializations text[] := '{}';
  v_risk_factors text[] := '{}';
  v_dept record;
  v_trust numeric;
  v_live_count integer;
  v_recent_failures_24h integer;
  v_goal_contrib integer;
  v_workflow_success numeric;
  v_delegation_effectiveness numeric;
begin
  select success_rate, tasks_completed + tasks_failed into v_overall_success, v_overall_total
  from public.agent_performance_metrics where agent_id = p_agent_id;

  select trust_score into v_trust from public.agents where id = p_agent_id;

  -- Task completion trend: last 30 days vs. the 30 days before that.
  select count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_recent_completed, v_recent_failed
  from public.tasks where assigned_agent_id = p_agent_id and status in ('completed', 'failed') and updated_at > now() - interval '30 days';
  select count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_prior_completed, v_prior_failed
  from public.tasks where assigned_agent_id = p_agent_id and status in ('completed', 'failed')
    and updated_at <= now() - interval '30 days' and updated_at > now() - interval '60 days';

  if (v_recent_completed + v_recent_failed) >= 5 and (v_prior_completed + v_prior_failed) >= 5 then
    v_recent_rate := v_recent_completed::numeric / (v_recent_completed + v_recent_failed) * 100;
    v_prior_rate := v_prior_completed::numeric / (v_prior_completed + v_prior_failed) * 100;
    if v_recent_rate - v_prior_rate >= 5 then v_growth_trend := 'improving';
    elsif v_recent_rate - v_prior_rate <= -5 then v_growth_trend := 'declining';
    else v_growth_trend := 'stable';
    end if;
  end if;

  -- Specializations/strengths/weaknesses: per-department success rate.
  -- Grouped by department id (not just name) since every organization
  -- seeds the same standard department names — grouping by name alone
  -- would conflate two different orgs' unrelated "Sales" departments.
  for v_dept in
    select d.name as dept_name, o.name as org_name, count(*) as n,
      round(count(*) filter (where t.status = 'completed')::numeric / count(*) * 100, 2) as rate
    from public.tasks t
    join public.organization_departments d on d.id = t.department_id
    join public.organizations o on o.id = d.organization_id
    where t.assigned_agent_id = p_agent_id and t.status in ('completed', 'failed')
    group by d.id, d.name, o.name
    having count(*) >= 3
  loop
    if v_dept.rate >= 70 then
      v_specializations := array_append(v_specializations, v_dept.dept_name);
      v_strengths := array_append(v_strengths, format('%s%% success rate in %s at %s (%s tasks)', v_dept.rate, v_dept.dept_name, v_dept.org_name, v_dept.n));
    elsif v_dept.rate <= 40 then
      v_weaknesses := array_append(v_weaknesses, format('%s%% success rate in %s at %s (%s tasks)', v_dept.rate, v_dept.dept_name, v_dept.org_name, v_dept.n));
    end if;
  end loop;

  if coalesce(v_trust, 0) >= 75 then
    v_strengths := array_append(v_strengths, 'High trust score');
  end if;
  if coalesce(v_overall_success, 0) < 40 and coalesce(v_overall_total, 0) >= 5 then
    v_weaknesses := array_append(v_weaknesses, 'Below-average overall success rate');
  end if;

  -- Risk factors
  select count(*) into v_live_count from public.agent_executions where agent_id = p_agent_id and status in ('queued', 'running');
  select count(*) into v_recent_failures_24h from public.agent_executions where agent_id = p_agent_id and status = 'failed' and created_at > now() - interval '24 hours';

  if coalesce(v_trust, 0) < 30 then v_risk_factors := array_append(v_risk_factors, 'Low trust score'); end if;
  if v_live_count >= 3 then v_risk_factors := array_append(v_risk_factors, 'Currently overloaded'); end if;
  if v_recent_failures_24h >= 3 then v_risk_factors := array_append(v_risk_factors, 'Recent failure streak'); end if;
  if v_growth_trend = 'declining' then v_risk_factors := array_append(v_risk_factors, 'Declining performance trend'); end if;

  -- Goal contribution: completed tasks that were spawned by a goal plan step.
  select count(*) into v_goal_contrib
  from public.tasks where assigned_agent_id = p_agent_id and status = 'completed' and goal_plan_step_id is not null;

  -- Workflow performance: success rate restricted to workflow-spawned tasks.
  select case when count(*) > 0 then round(count(*) filter (where status = 'completed')::numeric / count(*) * 100, 2) else null end
  into v_workflow_success
  from public.tasks where assigned_agent_id = p_agent_id and status in ('completed', 'failed') and workflow_step_id is not null;

  -- Delegation effectiveness: of tasks this agent received via an accepted
  -- delegation, what share went on to actually complete?
  select case when count(*) > 0 then round(count(*) filter (where t.status = 'completed')::numeric / count(*) * 100, 2) else null end
  into v_delegation_effectiveness
  from public.delegations dl
  join public.tasks t on t.id = dl.task_id
  where dl.to_agent_id = p_agent_id and dl.status = 'accepted' and t.status in ('completed', 'failed');

  insert into public.agent_profiles_intelligence (
    agent_id, strengths, weaknesses, specializations, risk_factors, growth_trend,
    goal_contribution_count, workflow_success_rate, delegation_effectiveness, updated_at
  ) values (
    p_agent_id, v_strengths, v_weaknesses, v_specializations, v_risk_factors, v_growth_trend,
    coalesce(v_goal_contrib, 0), v_workflow_success, v_delegation_effectiveness, now()
  )
  on conflict (agent_id) do update set
    strengths = excluded.strengths, weaknesses = excluded.weaknesses, specializations = excluded.specializations,
    risk_factors = excluded.risk_factors, growth_trend = excluded.growth_trend,
    goal_contribution_count = excluded.goal_contribution_count, workflow_success_rate = excluded.workflow_success_rate,
    delegation_effectiveness = excluded.delegation_effectiveness, updated_at = now();
end;
$$;

-- ============================================================
-- 3. AGENT CAREER SYSTEM
-- ============================================================
create table if not exists public.agent_careers (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  first_task_id uuid references public.tasks(id) on delete set null,
  first_task_at timestamptz,
  last_task_id uuid references public.tasks(id) on delete set null,
  last_task_at timestamptz,
  promotion_history jsonb not null default '[]'::jsonb,
  organization_history jsonb not null default '[]'::jsonb,
  performance_history jsonb not null default '[]'::jsonb,
  career_score numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.agent_careers enable row level security;
create policy "agent_careers_select" on public.agent_careers for select using (true);

-- Shared writer for every career-history event (mirrors log_decision /
-- log_task_event: one function, one place every array field is appended).
create or replace function public.record_agent_career_event(p_agent_id uuid, p_event_type text, p_payload jsonb)
returns void language plpgsql security definer as $$
declare
  v_elem jsonb := p_payload || jsonb_build_object('event_type', p_event_type, 'at', now());
begin
  insert into public.agent_careers (agent_id) values (p_agent_id) on conflict (agent_id) do nothing;

  if p_event_type in ('joined_organization', 'left_organization') then
    update public.agent_careers set organization_history = public.jsonb_array_push_capped(organization_history, v_elem, 100), updated_at = now()
    where agent_id = p_agent_id;
  elsif p_event_type in ('became_goal_manager', 'priority_increase') then
    update public.agent_careers set promotion_history = public.jsonb_array_push_capped(promotion_history, v_elem, 100), updated_at = now()
    where agent_id = p_agent_id;
  end if;
end;
$$;

-- Recomputes first/last task, appends a (throttled) performance snapshot,
-- and rescores the composite career_score.
create or replace function public.recompute_agent_career(p_agent_id uuid)
returns void language plpgsql security definer as $$
declare
  v_first_id uuid;
  v_first_at timestamptz;
  v_last_id uuid;
  v_last_at timestamptz;
  v_existing_first timestamptz;
  v_trust numeric;
  v_success_rate numeric;
  v_promotion_count integer;
  v_tenure_days numeric;
  v_growth_trend text;
  v_last_snapshot_at timestamptz;
  v_snapshot jsonb;
  v_history jsonb;
  v_career_score numeric;
begin
  insert into public.agent_careers (agent_id) values (p_agent_id) on conflict (agent_id) do nothing;

  select first_task_at, jsonb_array_length(coalesce(promotion_history, '[]'::jsonb))
  into v_existing_first, v_promotion_count
  from public.agent_careers where agent_id = p_agent_id;

  if v_existing_first is null then
    select id, created_at into v_first_id, v_first_at from public.tasks
    where assigned_agent_id = p_agent_id order by created_at asc limit 1;
  end if;

  select id, completed_at into v_last_id, v_last_at from public.tasks
  where assigned_agent_id = p_agent_id and completed_at is not null order by completed_at desc limit 1;

  select trust_score into v_trust from public.agents where id = p_agent_id;
  select success_rate into v_success_rate from public.agent_performance_metrics where agent_id = p_agent_id;
  select growth_trend into v_growth_trend from public.agent_profiles_intelligence where agent_id = p_agent_id;

  v_tenure_days := case when coalesce(v_existing_first, v_first_at) is not null
    then extract(epoch from (now() - coalesce(v_existing_first, v_first_at))) / 86400.0 else 0 end;

  v_career_score := round(least(100, greatest(0,
    (coalesce(v_trust, 0) * 0.3) +
    (coalesce(v_success_rate, 0) * 0.3) +
    (least(v_tenure_days, 180) / 180.0 * 100 * 0.2) +
    (least(coalesce(v_promotion_count, 0) * 10, 20)) +
    (case v_growth_trend when 'improving' then 5 when 'declining' then -5 else 0 end)
  )), 2);

  select performance_history into v_history from public.agent_careers where agent_id = p_agent_id;
  select (v_history -> -1 ->> 'at')::timestamptz into v_last_snapshot_at;

  if v_last_snapshot_at is null or v_last_snapshot_at < now() - interval '24 hours' then
    v_snapshot := jsonb_build_object('trust_score', coalesce(v_trust, 0), 'success_rate', coalesce(v_success_rate, 0), 'career_score', v_career_score, 'at', now());
    v_history := public.jsonb_array_push_capped(v_history, v_snapshot, 90);
  end if;

  update public.agent_careers set
    first_task_id = coalesce(agent_careers.first_task_id, v_first_id),
    first_task_at = coalesce(agent_careers.first_task_at, v_first_at),
    last_task_id = coalesce(v_last_id, agent_careers.last_task_id),
    last_task_at = coalesce(v_last_at, agent_careers.last_task_at),
    performance_history = v_history,
    career_score = v_career_score,
    updated_at = now()
  where agent_id = p_agent_id;
end;
$$;

-- ============================================================
-- 4. ORGANIZATION INTELLIGENCE
-- ============================================================
-- Public, same visibility precedent as organization_metrics (Phase 3) —
-- an aggregate performance rollup, not internal risk/planning state
-- (that's what organization_state, member-scoped, is for).
create table if not exists public.organization_health (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  goal_completion_rate numeric(5,2) not null default 0,
  workflow_completion_rate numeric(5,2) not null default 0,
  agent_utilization numeric(5,2) not null default 0,
  task_throughput integer not null default 0,
  failure_rate numeric(5,2) not null default 0,
  autonomy_score numeric(5,2) not null default 0,
  health_score numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.organization_health enable row level security;
create policy "organization_health_select" on public.organization_health for select using (true);

-- Org-scoped variant of Phase 8's compute_autonomy_score() (which is
-- platform-wide) — same four proxies, restricted to one organization.
create or replace function public.compute_org_autonomy_score(p_org_id uuid)
returns numeric language plpgsql security definer stable as $$
declare
  v_total_tasks bigint; v_auto_tasks bigint;
  v_completed_tasks bigint; v_auto_completed bigint;
  v_completed_goals bigint; v_failed_goals bigint;
  v_completed_runs bigint; v_autonomous_runs bigint;
  v_a numeric; v_b numeric; v_c numeric; v_d numeric;
begin
  select count(*), count(*) filter (where workflow_step_id is not null or goal_plan_step_id is not null)
  into v_total_tasks, v_auto_tasks from public.tasks where organization_id = p_org_id;
  v_a := case when v_total_tasks > 0 then round(v_auto_tasks::numeric / v_total_tasks * 100, 2) else 0 end;

  select count(*) into v_completed_tasks from public.tasks where organization_id = p_org_id and status = 'completed';
  select count(distinct t.id) into v_auto_completed
  from public.tasks t join public.agent_executions e on e.task_id = t.id and e.status = 'completed'
  where t.organization_id = p_org_id and t.status = 'completed';
  v_b := case when v_completed_tasks > 0 then round(v_auto_completed::numeric / v_completed_tasks * 100, 2) else 0 end;

  select count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_completed_goals, v_failed_goals from public.organization_goals where organization_id = p_org_id;
  v_c := case when (v_completed_goals + v_failed_goals) > 0 then round(v_completed_goals::numeric / (v_completed_goals + v_failed_goals) * 100, 2) else 0 end;

  select count(*) into v_completed_runs from public.workflow_runs where organization_id = p_org_id and status = 'completed';
  select count(*) into v_autonomous_runs from public.workflow_runs r
  where r.organization_id = p_org_id and r.status = 'completed'
    and not exists (
      select 1 from public.tasks t where t.workflow_run_id = r.id and t.status = 'completed'
        and not exists (select 1 from public.agent_executions e where e.task_id = t.id and e.status = 'completed')
    );
  v_d := case when v_completed_runs > 0 then round(v_autonomous_runs::numeric / v_completed_runs * 100, 2) else 0 end;

  return round((v_a + v_b + v_c + v_d) / 4.0, 2);
end;
$$;

create or replace function public.recompute_organization_health(p_org_id uuid)
returns void language plpgsql security definer as $$
declare
  v_goal_completed integer; v_goal_failed integer;
  v_run_completed integer; v_run_total integer;
  v_task_completed integer; v_task_failed integer; v_task_throughput integer;
  v_agent_utilization numeric;
  v_autonomy numeric;
  v_risk numeric;
  v_health numeric;
begin
  select count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_goal_completed, v_goal_failed from public.organization_goals where organization_id = p_org_id;

  select count(*), count(*) filter (where status = 'completed')
  into v_run_total, v_run_completed from public.workflow_runs where organization_id = p_org_id;

  select count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
  into v_task_completed, v_task_failed from public.tasks where organization_id = p_org_id;

  select count(*) into v_task_throughput from public.tasks
  where organization_id = p_org_id and status in ('completed', 'failed') and updated_at > now() - interval '24 hours';

  select agent_utilization, risk_score into v_agent_utilization, v_risk from public.organization_state where organization_id = p_org_id;
  v_autonomy := public.compute_org_autonomy_score(p_org_id);

  v_health := round(least(100, greatest(0,
    (case when (v_goal_completed + v_goal_failed) > 0 then v_goal_completed::numeric / (v_goal_completed + v_goal_failed) * 100 else 50 end) * 0.25 +
    (case when v_run_total > 0 then v_run_completed::numeric / v_run_total * 100 else 50 end) * 0.20 +
    coalesce(v_agent_utilization, 0) * 0.20 +
    (case when (v_task_completed + v_task_failed) > 0 then v_task_completed::numeric / (v_task_completed + v_task_failed) * 100 else 50 end) * 0.15 +
    v_autonomy * 0.20 -
    coalesce(v_risk, 0) * 0.20
  )), 2);

  insert into public.organization_health (
    organization_id, goal_completion_rate, workflow_completion_rate, agent_utilization,
    task_throughput, failure_rate, autonomy_score, health_score, updated_at
  ) values (
    p_org_id,
    case when (v_goal_completed + v_goal_failed) > 0 then round(v_goal_completed::numeric / (v_goal_completed + v_goal_failed) * 100, 2) else 0 end,
    case when v_run_total > 0 then round(v_run_completed::numeric / v_run_total * 100, 2) else 0 end,
    coalesce(round(v_agent_utilization, 2), 0),
    v_task_throughput,
    case when (v_task_completed + v_task_failed) > 0 then round(v_task_failed::numeric / (v_task_completed + v_task_failed) * 100, 2) else 0 end,
    v_autonomy, v_health, now()
  )
  on conflict (organization_id) do update set
    goal_completion_rate = excluded.goal_completion_rate,
    workflow_completion_rate = excluded.workflow_completion_rate,
    agent_utilization = excluded.agent_utilization,
    task_throughput = excluded.task_throughput,
    failure_rate = excluded.failure_rate,
    autonomy_score = excluded.autonomy_score,
    health_score = excluded.health_score,
    updated_at = now();
end;
$$;

-- ============================================================
-- 5. REACTIVE WIRING (extends existing Phase 3/5/6/8 trigger functions
--    rather than adding parallel triggers on the same events)
-- ============================================================
create or replace function public.trg_tasks_after_status_complete()
returns trigger language plpgsql security definer as $$
declare
  v_response_ms integer;
begin
  if new.status in ('completed', 'failed') and old.status not in ('completed', 'failed') and new.assigned_agent_id is not null then
    v_response_ms := case when new.execution_time_seconds is not null then new.execution_time_seconds * 1000 else null end;
    perform public.apply_task_completion_metrics(new.assigned_agent_id, new.status = 'completed', v_response_ms);

    begin
      perform public.recompute_agent_intelligence(new.assigned_agent_id);
    exception when others then null;
    end;
    begin
      perform public.recompute_agent_career(new.assigned_agent_id);
    exception when others then null;
    end;
  end if;
  return new;
end;
$$;

create or replace function public.trg_tasks_after_update_org_state()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_organization_state(new.organization_id);
  begin
    perform public.recompute_organization_health(new.organization_id);
  exception when others then null;
  end;
  return new;
end;
$$;

create or replace function public.trg_organization_goals_after_change()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_organization_state(coalesce(new.organization_id, old.organization_id));
  begin
    perform public.recompute_organization_health(coalesce(new.organization_id, old.organization_id));
  exception when others then null;
  end;
  if tg_op in ('INSERT', 'UPDATE') and new.manager_agent_id is not null
     and (tg_op = 'INSERT' or old.manager_agent_id is distinct from new.manager_agent_id) then
    begin
      perform public.record_agent_career_event(new.manager_agent_id, 'became_goal_manager', jsonb_build_object('goal_id', new.id, 'organization_id', new.organization_id));
    exception when others then null;
    end;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.trg_workflow_runs_after_update()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.log_organization_activity(new.organization_id, 'workflow_completed', jsonb_build_object('workflow_id', new.workflow_id, 'workflow_run_id', new.id));
  end if;
  begin
    perform public.recompute_organization_health(new.organization_id);
  exception when others then null;
  end;
  return new;
end;
$$;

create or replace function public.trg_agent_assignments_after_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_organization_metrics(new.organization_id);
  perform public.log_organization_activity(new.organization_id, 'agent_joined', jsonb_build_object('agent_id', new.agent_id, 'department_id', new.department_id));
  begin
    perform public.record_agent_career_event(new.agent_id, 'joined_organization', jsonb_build_object('organization_id', new.organization_id, 'department_id', new.department_id, 'priority', new.priority));
  exception when others then null;
  end;
  return new;
end;
$$;

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
    begin
      perform public.record_agent_career_event(new.agent_id, 'left_organization', jsonb_build_object('organization_id', new.organization_id));
    exception when others then null;
    end;
  end if;

  if public.priority_rank(new.priority) > public.priority_rank(old.priority) then
    begin
      perform public.record_agent_career_event(new.agent_id, 'priority_increase', jsonb_build_object('organization_id', new.organization_id, 'from_priority', old.priority, 'to_priority', new.priority));
    exception when others then null;
    end;
  end if;
  return new;
end;
$$;

-- Internal recompute helpers: system-driven, no acting user to authorize
-- against, so never directly callable — matches every prior phase's
-- recompute_*/apply_*/log_* revoke pattern (see section 12).

-- ============================================================
-- 6. WORKFLOW INTELLIGENCE
-- ============================================================
create or replace function public.get_workflow_intelligence(p_workflow_id uuid)
returns table (
  success_rate numeric,
  avg_duration_seconds numeric,
  total_runs bigint,
  failure_points jsonb,
  avg_handoff_seconds numeric
)
language plpgsql security definer stable as $$
begin
  return query
  select
    case when count(r.id) > 0 then round(count(r.id) filter (where r.status = 'completed')::numeric / count(r.id) * 100, 2) else 0 end,
    round(avg(extract(epoch from (r.completed_at - r.started_at))) filter (where r.completed_at is not null and r.started_at is not null), 2),
    count(r.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('step_order', s.step_order, 'name', s.name, 'failure_count', f.failure_count) order by f.failure_count desc)
      from (
        select ws.workflow_step_id, count(*) as failure_count
        from public.workflow_step_runs ws
        join public.workflow_runs wr on wr.id = ws.workflow_run_id
        where wr.workflow_id = p_workflow_id and ws.status = 'failed'
        group by ws.workflow_step_id
      ) f
      join public.workflow_steps s on s.id = f.workflow_step_id
    ), '[]'::jsonb),
    (
      select round(avg(extract(epoch from (next_run.started_at - cur_run.completed_at))), 2)
      from public.workflow_step_runs cur_run
      join public.workflow_steps cur_step on cur_step.id = cur_run.workflow_step_id
      join public.workflow_step_runs next_run on next_run.workflow_run_id = cur_run.workflow_run_id
      join public.workflow_steps next_step on next_step.id = next_run.workflow_step_id and next_step.step_order = cur_step.step_order + 1
      where cur_step.workflow_id = p_workflow_id and cur_run.completed_at is not null and next_run.started_at is not null
    )
  from public.workflow_runs r where r.workflow_id = p_workflow_id;
end;
$$;

-- ============================================================
-- 7. PREDICTION ENGINE
-- ============================================================
create or replace function public.predict_task_success(p_task_id uuid)
returns public.workforce_predictions language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_agent_id uuid;
  v_trust numeric;
  v_sample integer;
  v_prob numeric;
  v_confidence numeric;
  v_row public.workforce_predictions;
begin
  select organization_id, assigned_agent_id into v_org_id, v_agent_id from public.tasks where id = p_task_id;
  if not (public.is_admin() or public.is_org_supervisor(v_org_id, auth.uid())) then
    raise exception 'not authorized';
  end if;
  if v_agent_id is null then
    raise exception 'task has no assigned agent yet';
  end if;

  select trust_score into v_trust from public.agents where id = v_agent_id;
  select tasks_completed + tasks_failed into v_sample from public.agent_performance_metrics where agent_id = v_agent_id;

  v_prob := least(0.95, greatest(0.4, 0.5 + (coalesce(v_trust, 0) - 50) / 150.0));
  v_confidence := case when coalesce(v_sample, 0) >= 20 then 0.85 when coalesce(v_sample, 0) >= 5 then 0.6 else 0.35 end;

  insert into public.workforce_predictions (prediction_type, entity_type, entity_id, predicted_value, confidence, metadata)
  values ('task_success_probability', 'task', p_task_id, round(v_prob * 100, 2), v_confidence, jsonb_build_object('agent_id', v_agent_id, 'sample_size', coalesce(v_sample, 0)))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.predict_goal_success(p_goal_id uuid)
returns public.workforce_predictions language plpgsql security definer as $$
declare
  v_goal public.organization_goals%rowtype;
  v_plan_id uuid;
  v_total integer; v_completed integer; v_failed integer;
  v_ratio numeric;
  v_risk numeric;
  v_prob numeric;
  v_confidence numeric;
  v_row public.workforce_predictions;
begin
  select * into v_goal from public.organization_goals where id = p_goal_id;
  if not (public.is_admin() or public.is_org_supervisor(v_goal.organization_id, auth.uid())) then
    raise exception 'not authorized';
  end if;
  select id into v_plan_id from public.goal_plans where goal_id = p_goal_id and status = 'approved' order by created_at desc limit 1;

  if v_plan_id is not null then
    select count(*), count(*) filter (where status = 'completed'), count(*) filter (where status = 'failed')
    into v_total, v_completed, v_failed from public.goal_plan_steps where plan_id = v_plan_id;
  end if;

  v_ratio := case when coalesce(v_total, 0) > 0 then v_completed::numeric / v_total * 100 else 50 end;
  select risk_score into v_risk from public.organization_state where organization_id = v_goal.organization_id;

  v_prob := v_ratio - coalesce(v_risk, 0) * 0.3;
  if v_goal.deadline is not null and v_goal.deadline < now() and v_goal.status = 'active' then
    v_prob := v_prob - 20;
  end if;
  v_prob := round(least(100, greatest(0, v_prob)), 2);
  v_confidence := case when v_plan_id is not null then 0.7 else 0.3 end;

  insert into public.workforce_predictions (prediction_type, entity_type, entity_id, predicted_value, confidence, metadata)
  values ('goal_success_probability', 'goal', p_goal_id, v_prob, v_confidence, jsonb_build_object('plan_id', v_plan_id, 'step_completion_ratio', v_ratio, 'organization_risk', v_risk))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.predict_workflow_failure(p_workflow_id uuid)
returns public.workforce_predictions language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_intel record;
  v_avg_trust numeric;
  v_historical_failure numeric;
  v_prob numeric;
  v_confidence numeric;
  v_row public.workforce_predictions;
begin
  select organization_id into v_org_id from public.workflows where id = p_workflow_id;
  if not (public.is_admin() or public.is_org_supervisor(v_org_id, auth.uid())) then
    raise exception 'not authorized';
  end if;
  select * into v_intel from public.get_workflow_intelligence(p_workflow_id);
  select avg(a.trust_score) into v_avg_trust
  from public.workflow_steps s join public.agents a on a.id = s.agent_id where s.workflow_id = p_workflow_id;

  v_historical_failure := 100 - coalesce(v_intel.success_rate, 50);
  v_prob := round(least(100, greatest(0, v_historical_failure * 0.7 + (100 - coalesce(v_avg_trust, 50)) * 0.3)), 2);
  v_confidence := case when coalesce(v_intel.total_runs, 0) >= 10 then 0.8 when coalesce(v_intel.total_runs, 0) >= 3 then 0.55 else 0.3 end;

  insert into public.workforce_predictions (prediction_type, entity_type, entity_id, predicted_value, confidence, metadata)
  values ('workflow_failure_probability', 'workflow', p_workflow_id, v_prob, v_confidence, jsonb_build_object('historical_success_rate', v_intel.success_rate, 'total_runs', v_intel.total_runs, 'avg_step_agent_trust', v_avg_trust))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.predict_agent_burnout(p_agent_id uuid)
returns public.workforce_predictions language plpgsql security definer as $$
declare
  v_live_count integer;
  v_recent_failures integer;
  v_active_seconds bigint;
  v_trust numeric;
  v_risk numeric;
  v_confidence numeric;
  v_row public.workforce_predictions;
begin
  if not (
    public.is_admin()
    or exists (select 1 from public.agents where id = p_agent_id and owner_id = auth.uid())
    or exists (
      select 1 from public.agent_assignments aa
      where aa.agent_id = p_agent_id and aa.status = 'active' and public.is_org_supervisor(aa.organization_id, auth.uid())
    )
  ) then
    raise exception 'not authorized';
  end if;

  select count(*) into v_live_count from public.agent_executions where agent_id = p_agent_id and status in ('queued', 'running');
  select count(*) into v_recent_failures from public.agent_executions where agent_id = p_agent_id and status = 'failed' and created_at > now() - interval '24 hours';
  select active_seconds into v_active_seconds from public.agent_utilization where agent_id = p_agent_id;
  select trust_score into v_trust from public.agents where id = p_agent_id;

  v_risk := round(least(100, greatest(0,
    (least(v_live_count, 5) / 5.0 * 40) +
    (least(v_recent_failures, 5) / 5.0 * 30) +
    (least(coalesce(v_active_seconds, 0), 28800) / 28800.0 * 20) +
    (case when coalesce(v_trust, 50) < 30 then 10 else 0 end)
  )), 2);
  v_confidence := 0.5;

  insert into public.workforce_predictions (prediction_type, entity_type, entity_id, predicted_value, confidence, metadata)
  values ('agent_burnout_risk', 'agent', p_agent_id, v_risk, v_confidence, jsonb_build_object('live_executions', v_live_count, 'recent_failures_24h', v_recent_failures, 'active_seconds', v_active_seconds))
  returning * into v_row;
  return v_row;
end;
$$;

-- Deliberately reuses Phase 6's compute_organization_risk_score() rather
-- than re-deriving organization risk from scratch — this just logs that
-- existing, already-computed signal as a tracked prediction over time.
create or replace function public.predict_organization_risk(p_org_id uuid)
returns public.workforce_predictions language plpgsql security definer as $$
declare
  v_risk numeric;
  v_task_sample integer;
  v_confidence numeric;
  v_row public.workforce_predictions;
begin
  if not (public.is_admin() or public.is_org_supervisor(p_org_id, auth.uid())) then
    raise exception 'not authorized';
  end if;
  v_risk := public.compute_organization_risk_score(p_org_id);
  select count(*) into v_task_sample from public.tasks where organization_id = p_org_id;
  v_confidence := case when v_task_sample >= 20 then 0.8 when v_task_sample >= 5 then 0.55 else 0.3 end;

  insert into public.workforce_predictions (prediction_type, entity_type, entity_id, predicted_value, confidence, metadata)
  values ('organization_risk_score', 'organization', p_org_id, v_risk, v_confidence, jsonb_build_object('task_sample_size', v_task_sample))
  returning * into v_row;
  return v_row;
end;
$$;

-- On-demand batch refresh for one organization's whole world (agents,
-- goals, workflows, plus the org itself) — the "no background worker"
-- pattern from Phase 5-8 continues: this is a manual button, not a cron.
create or replace function public.refresh_predictions_for_organization(p_org_id uuid)
returns integer language plpgsql security definer as $$
declare
  v_count integer := 0;
  v_row record;
begin
  if not (public.is_admin() or public.is_org_supervisor(p_org_id, auth.uid())) then
    raise exception 'not authorized';
  end if;

  perform public.predict_organization_risk(p_org_id);
  v_count := v_count + 1;

  for v_row in select distinct agent_id from public.agent_assignments where organization_id = p_org_id and status = 'active' loop
    perform public.predict_agent_burnout(v_row.agent_id);
    v_count := v_count + 1;
  end loop;

  for v_row in select id from public.organization_goals where organization_id = p_org_id and status = 'active' loop
    perform public.predict_goal_success(v_row.id);
    v_count := v_count + 1;
  end loop;

  for v_row in select id from public.workflows where organization_id = p_org_id loop
    perform public.predict_workflow_failure(v_row.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ============================================================
-- 8. RECOMMENDATION ENGINE
-- ============================================================
create or replace function public.generate_recommendations_for_organization(p_org_id uuid)
returns integer language plpgsql security definer as $$
declare
  v_count integer := 0;
  v_dept record;
  v_step record;
  v_overloaded record;
  v_backlog record;
begin
  if not (public.is_admin() or public.is_org_supervisor(p_org_id, auth.uid())) then
    raise exception 'not authorized';
  end if;

  -- Reassignment: an agent specialized (per agent_profiles_intelligence)
  -- in a department other than the one they're currently assigned to.
  for v_dept in
    select aa.agent_id, a.name as agent_name, aa.department_id as current_dept_id,
      d_current.name as current_dept_name, d_target.id as target_dept_id, d_target.name as target_dept_name
    from public.agent_assignments aa
    join public.agents a on a.id = aa.agent_id
    join public.agent_profiles_intelligence api on api.agent_id = aa.agent_id
    left join public.organization_departments d_current on d_current.id = aa.department_id
    join public.organization_departments d_target on d_target.organization_id = p_org_id
      and d_target.name = any(api.specializations) and d_target.id is distinct from aa.department_id
    where aa.organization_id = p_org_id and aa.status = 'active'
    limit 20
  loop
    insert into public.workforce_recommendations (recommendation_type, entity_type, entity_id, title, reason, expected_impact, confidence_score, metadata)
    values (
      'reassign_agent', 'agent', v_dept.agent_id,
      format('Move %s to %s Department', v_dept.agent_name, v_dept.target_dept_name),
      format('%s shows a specialization in %s that does not match its current %s assignment', v_dept.agent_name, v_dept.target_dept_name, coalesce(v_dept.current_dept_name, 'unassigned')),
      format('Higher expected task success rate by working in its strongest department (%s)', v_dept.target_dept_name),
      0.6,
      jsonb_build_object('organization_id', p_org_id, 'target_department_id', v_dept.target_dept_id)
    )
    on conflict (recommendation_type, entity_type, entity_id) where status = 'pending' do nothing;
    v_count := v_count + 1;
  end loop;

  -- Staffing: department where open tasks per active agent is high.
  for v_backlog in
    select d.id as department_id, d.name as department_name, count(distinct t.id) filter (where t.status in ('pending', 'assigned', 'in_progress')) as open_tasks,
      greatest(count(distinct aa.agent_id), 1) as agent_count
    from public.organization_departments d
    left join public.tasks t on t.department_id = d.id
    left join public.agent_assignments aa on aa.department_id = d.id and aa.status = 'active'
    where d.organization_id = p_org_id
    group by d.id, d.name
    having count(distinct t.id) filter (where t.status in ('pending', 'assigned', 'in_progress')) >= 3 * greatest(count(distinct aa.agent_id), 1)
  loop
    insert into public.workforce_recommendations (recommendation_type, entity_type, entity_id, title, reason, expected_impact, confidence_score, metadata)
    values (
      'add_agent', 'department', v_backlog.department_id,
      format('Add another %s Agent', v_backlog.department_name),
      format('%s open tasks across only %s active agent(s) in %s', v_backlog.open_tasks, v_backlog.agent_count, v_backlog.department_name),
      'Reduced backlog and faster task turnaround in this department',
      0.55,
      jsonb_build_object('organization_id', p_org_id, 'open_tasks', v_backlog.open_tasks, 'agent_count', v_backlog.agent_count)
    )
    on conflict (recommendation_type, entity_type, entity_id) where status = 'pending' do nothing;
    v_count := v_count + 1;
  end loop;

  -- Workflow steps with a high failure share of that workflow's runs.
  for v_step in
    select ws.id as step_id, ws.step_order, ws.name as step_name, w.id as workflow_id, w.name as workflow_name, f.failure_count, r.total_runs
    from public.workflow_steps ws
    join public.workflows w on w.id = ws.workflow_id
    join lateral (select count(*) as total_runs from public.workflow_runs where workflow_id = w.id) r on true
    join lateral (
      select count(*) as failure_count from public.workflow_step_runs wsr
      join public.workflow_runs wr on wr.id = wsr.workflow_run_id
      where wsr.workflow_step_id = ws.id and wsr.status = 'failed'
    ) f on true
    where w.organization_id = p_org_id and r.total_runs >= 3 and f.failure_count::numeric / r.total_runs >= 0.4
  loop
    insert into public.workforce_recommendations (recommendation_type, entity_type, entity_id, title, reason, expected_impact, confidence_score, metadata)
    values (
      'replace_workflow_step', 'workflow_step', v_step.step_id,
      format('Replace workflow step %s (%s) in %s', v_step.step_order, v_step.step_name, v_step.workflow_name),
      format('%s of %s runs failed at this step', v_step.failure_count, v_step.total_runs),
      'Fewer workflow run failures once the step is re-staffed or redesigned',
      least(0.9, 0.4 + (v_step.failure_count::numeric / v_step.total_runs) * 0.5),
      jsonb_build_object('organization_id', p_org_id, 'workflow_id', v_step.workflow_id, 'failure_count', v_step.failure_count, 'total_runs', v_step.total_runs)
    )
    on conflict (recommendation_type, entity_type, entity_id) where status = 'pending' do nothing;
    v_count := v_count + 1;
  end loop;

  -- Reassign overloaded agents. Inlined rather than calling Phase 8's
  -- find_overloaded_agents() (platform-wide and unconditionally
  -- admin-gated) — this function is also callable by an org supervisor,
  -- who isn't authorized to call that admin-only finder.
  for v_overloaded in
    select a.id as agent_id, a.name as agent_name, count(t.id) as live_task_count
    from public.agent_assignments aa
    join public.agents a on a.id = aa.agent_id
    join public.tasks t on t.assigned_agent_id = a.id and t.status in ('assigned', 'in_progress')
    where aa.organization_id = p_org_id and aa.status = 'active'
    group by a.id, a.name
    having count(t.id) >= 3
  loop
    insert into public.workforce_recommendations (recommendation_type, entity_type, entity_id, title, reason, expected_impact, confidence_score, metadata)
    values (
      'rebalance_load', 'agent', v_overloaded.agent_id,
      format('Reassign tasks from %s', v_overloaded.agent_name),
      format('%s currently has %s concurrent tasks', v_overloaded.agent_name, v_overloaded.live_task_count),
      'Shorter queue time for this agent''s remaining tasks',
      0.6,
      jsonb_build_object('organization_id', p_org_id, 'live_task_count', v_overloaded.live_task_count)
    )
    on conflict (recommendation_type, entity_type, entity_id) where status = 'pending' do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ============================================================
-- 9. SELF-OPTIMIZATION
-- ============================================================
-- A recommendation being applied is its own organization-activity event.
alter table public.organization_activity drop constraint if exists organization_activity_activity_type_check;
alter table public.organization_activity add constraint organization_activity_activity_type_check
  check (activity_type in (
    'member_joined', 'member_removed', 'agent_joined', 'agent_removed',
    'department_created', 'verification_earned', 'trust_score_changed',
    'assignment_completed', 'workflow_completed',
    'goal_created', 'goal_completed', 'goal_failed', 'plan_approved',
    'recommendation_applied'
  ));

-- Extend the decision-type vocabulary so a manager agent's review of a
-- recommendation is logged exactly like every other decision in this
-- system (same agent_decisions table Phase 5/6 already built).
alter table public.agent_decisions drop constraint if exists agent_decisions_decision_type_check;
alter table public.agent_decisions add constraint agent_decisions_decision_type_check
  check (decision_type in (
    'accept_task', 'complete_task', 'request_assistance', 'delegate',
    'create_task', 'assign_task', 'monitor_progress', 'escalate_failure',
    'review_recommendation'
  ));

-- A manager agent can "consume" a recommendation — i.e. acknowledge and
-- reason about it — but this never changes the recommendation's status.
-- Only a human, via approve/reject/apply below, can do that.
create or replace function public.agent_review_recommendation(p_recommendation_id uuid, p_agent_id uuid, p_note text default null)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  if not (public.is_admin() or exists (select 1 from public.agents where id = p_agent_id and owner_id = auth.uid())) then
    raise exception 'not authorized';
  end if;

  insert into public.agent_decisions (agent_id, decision_type, outcome, reasoning, metadata)
  values (p_agent_id, 'review_recommendation', 'yes', coalesce(p_note, 'Recommendation reviewed'), jsonb_build_object('recommendation_id', p_recommendation_id))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.approve_recommendation(p_recommendation_id uuid)
returns public.workforce_recommendations language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_row public.workforce_recommendations;
begin
  select (metadata->>'organization_id')::uuid into v_org_id from public.workforce_recommendations where id = p_recommendation_id;
  if v_org_id is null or not (public.is_admin() or public.is_org_manager(v_org_id, auth.uid())) then
    raise exception 'not authorized';
  end if;

  update public.workforce_recommendations set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_recommendation_id and status = 'pending' returning * into v_row;

  if v_row.id is null then
    raise exception 'recommendation not found or not pending';
  end if;
  return v_row;
end;
$$;

create or replace function public.reject_recommendation(p_recommendation_id uuid, p_note text default null)
returns public.workforce_recommendations language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_row public.workforce_recommendations;
begin
  select (metadata->>'organization_id')::uuid into v_org_id from public.workforce_recommendations where id = p_recommendation_id;
  if v_org_id is null or not (public.is_admin() or public.is_org_manager(v_org_id, auth.uid())) then
    raise exception 'not authorized';
  end if;

  update public.workforce_recommendations
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      metadata = metadata || jsonb_build_object('rejection_note', p_note)
  where id = p_recommendation_id and status = 'pending' returning * into v_row;

  if v_row.id is null then
    raise exception 'recommendation not found or not pending';
  end if;
  return v_row;
end;
$$;

-- Executes the concrete, mechanical part of an approved recommendation.
-- Only 'approved' recommendations can be applied — nothing here ever
-- runs without the human approval step above having happened first.
create or replace function public.apply_recommendation(p_recommendation_id uuid)
returns public.workforce_recommendations language plpgsql security definer as $$
declare
  v_rec public.workforce_recommendations;
  v_org_id uuid;
  v_alt_agent_id uuid;
  v_oldest_task_id uuid;
begin
  select * into v_rec from public.workforce_recommendations where id = p_recommendation_id;
  if v_rec.id is null then
    raise exception 'recommendation not found';
  end if;
  v_org_id := (v_rec.metadata->>'organization_id')::uuid;
  if v_org_id is null or not (public.is_admin() or public.is_org_manager(v_org_id, auth.uid())) then
    raise exception 'not authorized';
  end if;
  if v_rec.status <> 'approved' then
    raise exception 'recommendation must be approved before it can be applied';
  end if;

  if v_rec.recommendation_type = 'reassign_agent' then
    update public.agent_assignments set department_id = (v_rec.metadata->>'target_department_id')::uuid
    where agent_id = v_rec.entity_id and organization_id = v_org_id and status = 'active';

  elsif v_rec.recommendation_type = 'rebalance_load' then
    select agent_id into v_alt_agent_id from public.agent_assignments
    where organization_id = v_org_id and status = 'active' and agent_id <> v_rec.entity_id
    order by random() limit 1;
    if v_alt_agent_id is not null then
      select id into v_oldest_task_id from public.tasks
      where assigned_agent_id = v_rec.entity_id and status in ('assigned', 'in_progress')
      order by created_at asc limit 1;
      if v_oldest_task_id is not null then
        update public.tasks set assigned_agent_id = v_alt_agent_id where id = v_oldest_task_id;
      end if;
    end if;

  elsif v_rec.recommendation_type = 'replace_workflow_step' then
    update public.workflow_steps set agent_id = nullif(v_rec.metadata->>'suggested_agent_id', '')::uuid
    where id = v_rec.entity_id;

  elsif v_rec.recommendation_type = 'add_agent' then
    -- Deliberately not automated: creating a whole new staffed agent is a
    -- resourcing decision, not a mechanical field update. Applying this
    -- type only records the decision; a human still creates the agent.
    null;
  end if;

  perform public.log_organization_activity(v_org_id, 'recommendation_applied', jsonb_build_object('recommendation_id', p_recommendation_id, 'recommendation_type', v_rec.recommendation_type, 'title', v_rec.title));

  update public.workforce_recommendations set status = 'applied', applied_at = now() where id = p_recommendation_id returning * into v_rec;
  return v_rec;
end;
$$;

-- ============================================================
-- 10. BENCHMARKING (public — same visibility as /agents/top rankings)
-- ============================================================
create or replace function public.rank_agents(p_limit integer default 20)
returns table (agent_id uuid, name text, trust_score numeric, success_rate numeric, career_score numeric, rank bigint)
language sql stable as $$
  select a.id, a.name, a.trust_score, coalesce(pm.success_rate, 0), coalesce(ac.career_score, 0),
    row_number() over (order by coalesce(ac.career_score, 0) desc, a.trust_score desc)
  from public.agents a
  left join public.agent_performance_metrics pm on pm.agent_id = a.id
  left join public.agent_careers ac on ac.agent_id = a.id
  order by coalesce(ac.career_score, 0) desc, a.trust_score desc
  limit p_limit;
$$;

create or replace function public.rank_organizations(p_limit integer default 20)
returns table (organization_id uuid, name text, health_score numeric, rank bigint)
language sql stable as $$
  select o.id, o.name, coalesce(h.health_score, 0), row_number() over (order by coalesce(h.health_score, 0) desc)
  from public.organizations o
  left join public.organization_health h on h.organization_id = o.id
  order by coalesce(h.health_score, 0) desc
  limit p_limit;
$$;

create or replace function public.find_best_workflows(p_limit integer default 10)
returns table (workflow_id uuid, name text, success_rate numeric, total_runs bigint)
language plpgsql stable as $$
begin
  return query
  select w.id, w.name, i.success_rate, i.total_runs
  from public.workflows w
  join lateral public.get_workflow_intelligence(w.id) i on true
  where i.total_runs >= 1
  order by i.success_rate desc, i.total_runs desc
  limit p_limit;
end;
$$;

create or replace function public.find_worst_workflows(p_limit integer default 10)
returns table (workflow_id uuid, name text, success_rate numeric, total_runs bigint)
language plpgsql stable as $$
begin
  return query
  select w.id, w.name, i.success_rate, i.total_runs
  from public.workflows w
  join lateral public.get_workflow_intelligence(w.id) i on true
  where i.total_runs >= 1
  order by i.success_rate asc, i.total_runs desc
  limit p_limit;
end;
$$;

create or replace function public.rank_templates(p_limit integer default 20)
returns table (template_id uuid, name text, deployment_success_rate numeric, goal_completion_rate numeric, usage_count integer, rank bigint)
language plpgsql stable as $$
begin
  return query
  select t.id, t.name, m.deployment_success_rate, m.goal_completion_rate, m.usage_count,
    row_number() over (order by m.goal_completion_rate desc, m.deployment_success_rate desc)
  from public.workforce_templates t
  join lateral public.get_template_metrics(t.id) m on true
  order by m.goal_completion_rate desc, m.deployment_success_rate desc
  limit p_limit;
end;
$$;

create or replace function public.compare_agents(p_agent_id_a uuid, p_agent_id_b uuid)
returns table (agent_id uuid, name text, trust_score numeric, success_rate numeric, career_score numeric, growth_trend text)
language sql stable as $$
  select a.id, a.name, a.trust_score, coalesce(pm.success_rate, 0), coalesce(ac.career_score, 0), coalesce(api.growth_trend, 'insufficient_data')
  from public.agents a
  left join public.agent_performance_metrics pm on pm.agent_id = a.id
  left join public.agent_careers ac on ac.agent_id = a.id
  left join public.agent_profiles_intelligence api on api.agent_id = a.id
  where a.id in (p_agent_id_a, p_agent_id_b);
$$;

create or replace function public.compare_organizations(p_org_id_a uuid, p_org_id_b uuid)
returns table (organization_id uuid, name text, health_score numeric, goal_completion_rate numeric, workflow_completion_rate numeric, failure_rate numeric)
language sql stable as $$
  select o.id, o.name, coalesce(h.health_score, 0), coalesce(h.goal_completion_rate, 0), coalesce(h.workflow_completion_rate, 0), coalesce(h.failure_rate, 0)
  from public.organizations o
  left join public.organization_health h on h.organization_id = o.id
  where o.id in (p_org_id_a, p_org_id_b);
$$;

create or replace function public.compare_workflows(p_workflow_id_a uuid, p_workflow_id_b uuid)
returns table (workflow_id uuid, name text, success_rate numeric, avg_duration_seconds numeric, total_runs bigint)
language plpgsql stable as $$
begin
  return query
  select w.id, w.name, i.success_rate, i.avg_duration_seconds, i.total_runs
  from public.workflows w join lateral public.get_workflow_intelligence(w.id) i on true
  where w.id in (p_workflow_id_a, p_workflow_id_b);
end;
$$;

-- ============================================================
-- 11. ANOMALY DETECTION (admin-only; extends Phase 8's bottleneck
--     finders rather than re-deriving trust anomalies/deadlocks)
-- ============================================================
create or replace function public.find_unusual_failures(p_limit integer default 20)
returns table (agent_id uuid, agent_name text, recent_failure_rate numeric, historical_failure_rate numeric)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select a.id, a.name,
    round(recent.failed::numeric / greatest(recent.total, 1) * 100, 2),
    round(coalesce(pm.tasks_failed, 0)::numeric / greatest(coalesce(pm.tasks_completed, 0) + coalesce(pm.tasks_failed, 0), 1) * 100, 2)
  from public.agents a
  join public.agent_performance_metrics pm on pm.agent_id = a.id
  join lateral (
    select count(*) filter (where status = 'failed') as failed, count(*) as total
    from public.tasks where assigned_agent_id = a.id and status in ('completed', 'failed') and updated_at > now() - interval '24 hours'
  ) recent on true
  where recent.total >= 5
    and (recent.failed::numeric / recent.total * 100) - (coalesce(pm.tasks_failed, 0)::numeric / greatest(coalesce(pm.tasks_completed, 0) + coalesce(pm.tasks_failed, 0), 1) * 100) >= 30
  order by recent.failed::numeric / recent.total desc
  limit p_limit;
end;
$$;

create or replace function public.find_delegation_loops(p_limit integer default 20)
returns table (task_id uuid, delegation_count bigint, agents_involved uuid[])
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select d.task_id, count(distinct d.id), array_agg(distinct x)
  from public.delegations d, unnest(array[d.from_agent_id, d.to_agent_id]) x
  group by d.task_id
  having count(distinct d.id) >= 3
  order by count(distinct d.id) desc
  limit p_limit;
end;
$$;

create or replace function public.find_underperforming_organizations(p_limit integer default 20)
returns table (organization_id uuid, name text, health_score numeric, platform_avg numeric)
language plpgsql security definer stable as $$
declare
  v_platform_avg numeric;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select avg(organization_health.health_score) into v_platform_avg from public.organization_health;

  return query
  select o.id, o.name, h.health_score, round(coalesce(v_platform_avg, 0), 2)
  from public.organizations o
  join public.organization_health h on h.organization_id = o.id
  where h.health_score <= coalesce(v_platform_avg, 100) - 20
    and exists (select 1 from public.tasks t where t.organization_id = o.id)
  order by h.health_score asc
  limit p_limit;
end;
$$;

create or replace function public.detect_anomalies()
returns jsonb language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'unusual_failures', coalesce((select jsonb_agg(x) from public.find_unusual_failures(20) x), '[]'::jsonb),
    'trust_score_anomalies', coalesce((select jsonb_agg(x) from public.find_trust_score_anomalies(20) x), '[]'::jsonb),
    'delegation_loops', coalesce((select jsonb_agg(x) from public.find_delegation_loops(20) x), '[]'::jsonb),
    'workflow_deadlocks', coalesce((select jsonb_agg(x) from public.find_workflow_deadlocks(20) x), '[]'::jsonb),
    'underperforming_organizations', coalesce((select jsonb_agg(x) from public.find_underperforming_organizations(20) x), '[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- 12. EXECUTIVE INSIGHTS
-- ============================================================
alter table public.system_reports drop constraint if exists system_reports_report_type_check;
alter table public.system_reports add constraint system_reports_report_type_check check (report_type in ('daily', 'weekly', 'monthly'));

-- Redefines Phase 8's generate_system_report (same signature, same
-- table) to also fold in the intelligence layer: top performers by
-- career score, biggest risks from the prediction log, growth
-- opportunities from improving-trend agents and pending recommendations,
-- and confidence-ranked optimization suggestions — additive content keys
-- alongside Phase 8's existing network_health/autonomy_score/top_*/
-- problem_areas/optimization_opportunities, which are left unchanged.
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
  v_top_performers jsonb;
  v_biggest_risks jsonb;
  v_growth_opportunities jsonb;
  v_optimization_suggestions jsonb;
  v_content jsonb;
  v_row public.system_reports;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_report_type not in ('daily', 'weekly', 'monthly') then
    raise exception 'report type must be daily, weekly, or monthly';
  end if;

  v_period_start := case p_report_type
    when 'daily' then v_period_end - interval '1 day'
    when 'weekly' then v_period_end - interval '7 days'
    else v_period_end - interval '30 days'
  end;

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

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_top_performers from (select * from public.rank_agents(5)) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_biggest_risks from (
    select entity_type, entity_id, prediction_type, predicted_value, confidence from (
      select distinct on (entity_id) entity_type, entity_id, prediction_type, predicted_value, confidence
      from public.workforce_predictions
      where prediction_type in ('agent_burnout_risk', 'organization_risk_score') and created_at > v_period_start
      order by entity_id, created_at desc
    ) latest
    order by predicted_value desc
    limit 10
  ) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_growth_opportunities from (
    select a.id as agent_id, a.name, api.growth_trend, api.specializations
    from public.agent_profiles_intelligence api
    join public.agents a on a.id = api.agent_id
    where api.growth_trend = 'improving'
    limit 10
  ) x;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_optimization_suggestions from (
    select recommendation_type, entity_type, entity_id, title, reason, expected_impact, confidence_score
    from public.workforce_recommendations
    where status = 'pending'
    order by confidence_score desc
    limit 10
  ) x;

  v_content := jsonb_build_object(
    'network_health', to_jsonb(v_health),
    'autonomy_score', to_jsonb(v_autonomy),
    'top_organizations', v_top_orgs,
    'top_agents', v_top_agents,
    'problem_areas', v_problem_areas,
    'optimization_opportunities', v_opportunities,
    'top_performers', v_top_performers,
    'biggest_risks', v_biggest_risks,
    'growth_opportunities', v_growth_opportunities,
    'optimization_suggestions', v_optimization_suggestions
  );

  insert into public.system_reports (report_type, period_start, period_end, generated_by, content)
  values (p_report_type, v_period_start, v_period_end, auth.uid(), v_content)
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- 13. SECURITY HARDENING
-- ============================================================
revoke execute on function public.jsonb_array_push_capped(jsonb, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.record_agent_career_event(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.recompute_agent_intelligence(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_agent_career(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_organization_health(uuid) from public, anon, authenticated;
revoke execute on function public.compute_org_autonomy_score(uuid) from public, anon, authenticated;

-- Public-callable (admin- or org-manager/supervisor-gated internally, or
-- fully public for the benchmarking/ranking functions — same posture as
-- Phase 2's /agents/top rankings): predict_*, refresh_predictions_for_organization,
-- generate_recommendations_for_organization, agent_review_recommendation,
-- approve/reject/apply_recommendation, get_workflow_intelligence,
-- rank_*, find_best/worst_workflows, compare_*, find_unusual_failures,
-- find_delegation_loops, find_underperforming_organizations,
-- detect_anomalies, generate_system_report.

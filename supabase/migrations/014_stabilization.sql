-- ============================================================
-- Stabilization Sprint 1
-- No new functionality, no new phases, no new architecture — this
-- migration only hardens what Phases 1-10 already built: it closes the
-- duplicate-real-world-side-effect gap and the wrong-agent-assignment
-- bug the Phase 10 validation report found, and adds the activity-log
-- wiring the new diagnostics page reads.
-- ============================================================

-- ============================================================
-- 1. EXECUTION SAFETY: prevent duplicate real-world side effects
-- ============================================================
-- Denormalized copy of the capability's integration_action at the moment
-- an execution is created — lets the partial unique index below target
-- exactly (and only) the three real-side-effect actions, without
-- touching re-run behavior for plain LLM-only capabilities (harmless to
-- repeat, sometimes wanted — e.g. "regenerate this draft").
alter table public.agent_executions add column if not exists integration_action text
  check (integration_action in ('prospect_enrich', 'email_draft_send', 'crm_upsert'));

-- Once a real-world action has completed (or is in flight) for a given
-- task, no second execution of that same action can start for that same
-- task — full stop. A completed run is done; if more work is genuinely
-- needed (e.g. only some of a batch's emails failed to send), the
-- existing pattern is to create a new task, not re-run the old one. A
-- FAILED execution is deliberately NOT covered — a transient failure
-- (Hunter.io down, a bad token) must remain retryable, since nothing
-- irreversible happened in that case. This is a real unique index, so it
-- is enforced atomically even under concurrent requests — not just a
-- check the application code remembers to make.
create unique index if not exists agent_executions_one_completed_action_per_task
  on public.agent_executions (task_id, integration_action)
  where integration_action is not null and status in ('queued', 'running', 'completed');

-- ============================================================
-- 2. ASSIGNMENT ACCURACY: audit + fix run_goal_manager_cycle()'s
--    capability matching
-- ============================================================
-- The Phase 10 validation report found two related bugs in
-- assign_best_agent_for_task(): (a) decide_agent_accept_task() doesn't
-- require a capability match to accept a candidate, so on a fresh
-- deployment (every agent tied at trust_score 0) the loop could accept
-- whichever candidate happened to sort first — observed staffing the
-- CRM Agent onto a "Research Prospect" task; (b) the title/name matching
-- itself (substring + first-word-only) was fragile enough to also fail
-- the CRM Agent's own "Update CRM" task against its own "CRM Sync"
-- capability. Both are fixed below: a more robust word-overlap matcher,
-- and a matching-required-first, fallback-second assignment order.
create or replace function public.capability_matches_task(p_capability_name text, p_task_title text)
returns boolean language sql immutable as $$
  select exists (
    select 1
    from unnest(regexp_split_to_array(lower(coalesce(p_capability_name, '')), '\s+')) as cap_word
    join unnest(regexp_split_to_array(lower(coalesce(p_task_title, '')), '\s+')) as task_word
      on cap_word = task_word
    where length(cap_word) > 2
      and cap_word not in ('the', 'and', 'for', 'with', 'from')
  );
$$;

create or replace function public.assign_best_agent_for_task(p_task_id uuid, p_manager_agent_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_task public.tasks%rowtype;
  v_candidate record;
  v_capability_id uuid;
  v_capability_name text;
  v_accepted boolean;
  v_require_match boolean;
begin
  select * into v_task from public.tasks where id = p_task_id;

  foreach v_require_match in array array[true, false] loop
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
      v_capability_name := null;

      -- Only the required-match pass looks up a capability, and it's used
      -- here purely to find and RECORD which capability fits this task —
      -- not to bill it. decide_agent_accept_task is deliberately called
      -- below with a null capability_id regardless of pass: it's shared
      -- with the execution path (lib/runtime/execute.ts), where the same
      -- capability_id DOES trigger a real wallet-balance check — the
      -- right place for that gate, since that's when the cost is actually
      -- debited. Every fresh agent wallet starts at $0 (see 002_agents.sql),
      -- so gating ASSIGNMENT on funds that only matter at RUN time would
      -- mean no freshly deployed organization could ever get a correct,
      -- capability-matched auto-assignment — caught in local testing, not
      -- a hypothetical: every task fell back to the same wrong agent.
      if v_require_match then
        select c.id, c.name into v_capability_id, v_capability_name
        from public.agent_capabilities c
        where c.agent_id = v_candidate.agent_id and c.enabled
          and public.capability_matches_task(c.name, v_task.title)
        order by c.name
        limit 1;

        if v_capability_id is null then
          continue;
        end if;
      end if;

      v_accepted := public.decide_agent_accept_task(v_candidate.agent_id, p_task_id, null);

      if v_accepted then
        update public.tasks set assigned_agent_id = v_candidate.agent_id where id = p_task_id;

        -- Visibility: exactly why this agent, not another, was chosen.
        perform public.log_decision(
          p_manager_agent_id, p_task_id, null, 'assign_task', 'yes',
          case when v_capability_id is not null
            then format('Assigned to agent %s (trust %s) — capability "%s" matches this task by name', v_candidate.agent_id, v_candidate.trust_score, v_capability_name)
            else format('Assigned to agent %s (trust %s) — no agent had a name-matching capability; fell back to the highest-trust available agent', v_candidate.agent_id, v_candidate.trust_score)
          end,
          jsonb_build_object('candidate_agent_id', v_candidate.agent_id, 'task_title', v_task.title, 'required_match_this_pass', v_require_match),
          jsonb_build_object(
            'assigned_agent_id', v_candidate.agent_id, 'capability_id', v_capability_id, 'capability_name', v_capability_name,
            'match_type', case when v_capability_id is not null then 'capability_match' else 'fallback_no_match' end
          )
        );
        return true;
      end if;
    end loop;
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

-- ============================================================
-- 3. OBSERVABILITY: integration connect/disconnect/error events feed
--    the same organization_activity log every other org-wide event
--    already uses (Phase 3) — no new table.
-- ============================================================
alter table public.organization_activity drop constraint if exists organization_activity_activity_type_check;
alter table public.organization_activity add constraint organization_activity_activity_type_check
  check (activity_type in (
    'member_joined', 'member_removed', 'agent_joined', 'agent_removed',
    'department_created', 'verification_earned', 'trust_score_changed',
    'assignment_completed', 'workflow_completed',
    'goal_created', 'goal_completed', 'goal_failed', 'plan_approved',
    'recommendation_applied',
    'integration_connected', 'integration_disconnected', 'integration_error'
  ));

create or replace function public.connect_integration(p_org_id uuid, p_provider text, p_credentials jsonb)
returns public.organization_integrations language plpgsql security definer as $$
declare
  v_row public.organization_integrations;
begin
  if not public.is_org_manager(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_provider not in ('gmail', 'hubspot', 'hunter') then
    raise exception 'unknown provider %', p_provider;
  end if;

  insert into public.organization_integrations (organization_id, provider, status, credentials, connected_by, connected_at)
  values (p_org_id, p_provider, 'connected', p_credentials, auth.uid(), now())
  on conflict (organization_id, provider) do update set
    status = 'connected', credentials = excluded.credentials, connected_by = excluded.connected_by,
    connected_at = now(), last_error = null, updated_at = now()
  returning * into v_row;

  perform public.log_organization_activity(p_org_id, 'integration_connected', jsonb_build_object('provider', p_provider));

  return v_row;
end;
$$;

create or replace function public.disconnect_integration(p_org_id uuid, p_provider text)
returns void language plpgsql security definer as $$
begin
  if not public.is_org_manager(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.organization_integrations set status = 'disconnected', credentials = '{}'::jsonb, updated_at = now()
  where organization_id = p_org_id and provider = p_provider;

  perform public.log_organization_activity(p_org_id, 'integration_disconnected', jsonb_build_object('provider', p_provider));
end;
$$;

create or replace function public.record_integration_error(p_org_id uuid, p_provider text, p_error text)
returns void language plpgsql security definer as $$
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.organization_integrations
  set status = 'error', last_error = left(p_error, 2000), updated_at = now()
  where organization_id = p_org_id and provider = p_provider;

  perform public.log_organization_activity(p_org_id, 'integration_error', jsonb_build_object('provider', p_provider, 'error', left(p_error, 500)));
end;
$$;

-- ============================================================
-- 4. SECURITY HARDENING
-- ============================================================
-- capability_matches_task is a pure, side-effect-free predicate — safe
-- to leave publicly callable, nothing to revoke.

-- Found while validating this sprint's assignment fix against a real
-- Postgres role (not a service-role key — every write in this codebase
-- goes through the caller's own "authenticated" session): deploy_workforce_
-- template() was never marked `security definer`, in both its original
-- definition (009_workforce_templates.sql) and its Phase 10 redefinition
-- (013_sales_integrations.sql). It runs with the CALLING user's own
-- privileges, and partway through it calls increment_template_usage() —
-- which 009 deliberately revoked from authenticated/anon/public (correctly:
-- that function has no auth check of its own and just increments a
-- counter, so it must only ever be reached through a trusted wrapper).
-- The result: every real "Deploy Template" click, for every template, on
-- every phase since Phase 9, would fail outright with "permission denied
-- for function increment_template_usage" for an actual authenticated user
-- — the single most basic onboarding action in the product has never
-- actually been exercised against real grants. It only appeared to work in
-- this project's own local Postgres testing because that testing setup
-- grants EXECUTE on all functions to authenticated broadly before running
-- RLS/RPC checks, which silently papered over this exact gap every time.
-- The fix is not to re-grant increment_template_usage (that would let any
-- authenticated user inflate any template's usage_count directly, which is
-- exactly what the original revoke was preventing) — it's to make
-- deploy_workforce_template itself security definer, the same pattern
-- every other multi-step orchestration RPC in this schema already uses.
-- This introduces no new privilege: every write inside the function is
-- already scoped to auth.uid() (the real caller, unaffected by security
-- definer — auth.uid() reads the session's own JWT claim, not the
-- function owner's), so a caller can still only ever create and populate
-- their own new organization, never touch anyone else's.
create or replace function public.deploy_workforce_template(
  p_template_id uuid, p_organization_name text, p_industry text default null
)
returns uuid language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_agent_bp record;
  v_new_agent_id uuid;
  v_cap jsonb;
  v_mem jsonb;
  v_dept_id uuid;
  v_agent_id_by_blueprint jsonb := '{}'::jsonb;
  v_wf_bp record;
  v_new_workflow_id uuid;
  v_wf_step record;
  v_goal_bp record;
  v_manager_agent_id uuid;
begin
  insert into public.organizations (owner_id, name, slug, industry)
  values (
    auth.uid(), p_organization_name,
    lower(regexp_replace(p_organization_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
    p_industry
  )
  returning id into v_org_id;

  for v_agent_bp in select * from public.agent_blueprints where template_id = p_template_id loop
    insert into public.agents (owner_id, name, description, status)
    values (auth.uid(), v_agent_bp.name, coalesce(v_agent_bp.default_prompt, v_agent_bp.description), 'active')
    returning id into v_new_agent_id;

    v_agent_id_by_blueprint := v_agent_id_by_blueprint || jsonb_build_object(v_agent_bp.id::text, v_new_agent_id::text);

    for v_cap in select * from jsonb_array_elements(coalesce(v_agent_bp.capabilities, '[]'::jsonb)) loop
      insert into public.agent_capabilities (agent_id, name, description, cost_estimate, input_schema, output_schema, integration_action)
      values (
        v_new_agent_id,
        v_cap->>'name',
        v_cap->>'description',
        coalesce((v_cap->>'cost_estimate')::numeric, 0),
        coalesce(v_cap->'input_schema', '{}'::jsonb),
        coalesce(v_cap->'output_schema', '{}'::jsonb),
        nullif(v_cap->>'integration_action', '')
      );
    end loop;

    for v_mem in select * from jsonb_array_elements(coalesce(v_agent_bp.memory_defaults, '[]'::jsonb)) loop
      insert into public.agent_memory (agent_id, organization_id, memory_type, key, value)
      values (v_new_agent_id, v_org_id, v_mem->>'memory_type', v_mem->>'key', coalesce(v_mem->'value', '{}'::jsonb));
    end loop;

    v_dept_id := null;
    if v_agent_bp.department_slug is not null then
      select id into v_dept_id from public.organization_departments where organization_id = v_org_id and slug = v_agent_bp.department_slug;
    end if;

    insert into public.agent_assignments (agent_id, organization_id, department_id, assigned_by, source_agent_blueprint_id)
    values (v_new_agent_id, v_org_id, v_dept_id, auth.uid(), v_agent_bp.id);
  end loop;

  for v_wf_bp in select * from public.workflow_blueprints where template_id = p_template_id loop
    insert into public.workflows (organization_id, name, description, created_by, source_workflow_blueprint_id)
    values (v_org_id, v_wf_bp.name, v_wf_bp.description, auth.uid(), v_wf_bp.id)
    returning id into v_new_workflow_id;

    for v_wf_step in select * from public.workflow_blueprint_steps where workflow_blueprint_id = v_wf_bp.id order by step_order loop
      v_dept_id := null;
      if v_wf_step.department_slug is not null then
        select id into v_dept_id from public.organization_departments where organization_id = v_org_id and slug = v_wf_step.department_slug;
      end if;

      insert into public.workflow_steps (workflow_id, step_order, name, department_id, agent_id)
      values (
        v_new_workflow_id, v_wf_step.step_order, v_wf_step.name, v_dept_id,
        case when v_wf_step.agent_blueprint_id is not null
          then nullif(v_agent_id_by_blueprint ->> v_wf_step.agent_blueprint_id::text, '')::uuid
          else null end
      );
    end loop;
  end loop;

  for v_goal_bp in select * from public.goal_blueprints where template_id = p_template_id loop
    v_manager_agent_id := null;
    if v_goal_bp.manager_agent_blueprint_id is not null then
      v_manager_agent_id := nullif(v_agent_id_by_blueprint ->> v_goal_bp.manager_agent_blueprint_id::text, '')::uuid;
    end if;

    insert into public.organization_goals (
      organization_id, title, description, priority, target_metrics, manager_agent_id, created_by, source_goal_blueprint_id
    )
    values (
      v_org_id, v_goal_bp.title, v_goal_bp.description, v_goal_bp.priority,
      coalesce(v_goal_bp.target_metrics, '{}'::jsonb), v_manager_agent_id, auth.uid(), v_goal_bp.id
    );
  end loop;

  insert into public.template_deployments (template_id, organization_id, deployed_by, status)
  values (p_template_id, v_org_id, auth.uid(), 'success');
  perform public.increment_template_usage(p_template_id);

  return v_org_id;
end;
$$;

-- ============================================================
-- 5. DIAGNOSTICS: network-wide observability for the new /diagnostics
--    page, gated exactly like get_network_health()/compute_autonomy_score()
--    (Phase 11) — security definer + an internal is_admin() check, not a
--    new table, not a new RLS model.
-- ============================================================
create or replace function public.get_execution_history(p_limit integer default 50)
returns table (
  execution_id uuid, agent_id uuid, agent_name text, task_id uuid, task_title text,
  capability_name text, integration_action text, status text, provider text,
  error text, created_at timestamptz, completed_at timestamptz
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select e.id, e.agent_id, a.name, e.task_id, t.title, c.name, e.integration_action, e.status, e.provider,
      e.error, e.created_at, e.completed_at
    from public.agent_executions e
    join public.agents a on a.id = e.agent_id
    left join public.tasks t on t.id = e.task_id
    left join public.agent_capabilities c on c.id = e.capability_id
    order by e.created_at desc
    limit p_limit;
end;
$$;

create or replace function public.get_integration_history(p_limit integer default 50)
returns table (
  id uuid, organization_id uuid, organization_name text, activity_type text, payload jsonb, created_at timestamptz
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select oa.id, oa.organization_id, o.name, oa.activity_type, oa.payload, oa.created_at
    from public.organization_activity oa
    join public.organizations o on o.id = oa.organization_id
    where oa.activity_type in ('integration_connected', 'integration_disconnected', 'integration_error')
    order by oa.created_at desc
    limit p_limit;
end;
$$;

create or replace function public.get_execution_failures(p_limit integer default 50)
returns table (
  execution_id uuid, agent_id uuid, agent_name text, task_id uuid, task_title text,
  error text, created_at timestamptz
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select e.id, e.agent_id, a.name, e.task_id, t.title, e.error, e.created_at
    from public.agent_executions e
    join public.agents a on a.id = e.agent_id
    left join public.tasks t on t.id = e.task_id
    where e.status = 'failed'
    order by e.created_at desc
    limit p_limit;
end;
$$;

-- "Retries" surface as multiple execution rows against the same task —
-- there is no separate retry-count concept anywhere in this schema, and
-- this sprint doesn't invent one; it just makes the existing fact visible.
create or replace function public.get_task_retry_counts(p_limit integer default 50)
returns table (
  task_id uuid, task_title text, organization_id uuid, organization_name text,
  execution_count bigint, last_status text, last_created_at timestamptz
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select t.id, t.title, t.organization_id, o.name, count(e.id),
      (array_agg(e.status order by e.created_at desc))[1],
      max(e.created_at)
    from public.agent_executions e
    join public.tasks t on t.id = e.task_id
    join public.organizations o on o.id = t.organization_id
    group by t.id, t.title, t.organization_id, o.name
    having count(e.id) > 1
    order by max(e.created_at) desc
    limit p_limit;
end;
$$;

-- agent_decisions.agent_id on an 'assign_task' row is the MANAGER who made
-- the decision, not the agent it assigned — that candidate's id only lives
-- inside outputs->>'assigned_agent_id' (see assign_best_agent_for_task
-- above). A diagnostics view answering "why was this agent chosen" needs
-- both names, or it just shows the manager's name on every row.
create or replace function public.get_assignment_decisions(p_limit integer default 50)
returns table (
  id uuid, task_id uuid, task_title text, manager_agent_id uuid, manager_agent_name text,
  assigned_agent_id uuid, assigned_agent_name text,
  outcome text, reasoning text, outputs jsonb, created_at timestamptz
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select d.id, d.task_id, t.title, d.agent_id, mgr.name,
      nullif(d.outputs->>'assigned_agent_id', '')::uuid, asg.name,
      d.outcome, d.reasoning, d.outputs, d.created_at
    from public.agent_decisions d
    join public.agents mgr on mgr.id = d.agent_id
    left join public.tasks t on t.id = d.task_id
    left join public.agents asg on asg.id = nullif(d.outputs->>'assigned_agent_id', '')::uuid
    where d.decision_type in ('assign_task', 'create_task')
    order by d.created_at desc
    limit p_limit;
end;
$$;

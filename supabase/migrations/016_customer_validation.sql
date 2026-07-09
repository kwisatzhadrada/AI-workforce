-- ============================================================
-- Customer Validation Sprint
-- No new platform layer, no new architecture. Two real additions:
-- (1) the funnel events explicitly asked for (organization created,
-- workforce deployed, campaign launched, emails drafted/sent, replies,
-- meetings) feeding the existing organization_activity/sales_activities
-- event logs, plus two admin-gated read RPCs to see them; (2) a minimal
-- feedback table (bug/feature/general), following the same RLS +
-- security-definer patterns every other table in this schema already
-- uses.
-- ============================================================

-- ============================================================
-- 1. ANALYTICS EVENTS
-- ============================================================
alter table public.organization_activity drop constraint if exists organization_activity_activity_type_check;
alter table public.organization_activity add constraint organization_activity_activity_type_check
  check (activity_type in (
    'member_joined', 'member_removed', 'agent_joined', 'agent_removed',
    'department_created', 'verification_earned', 'trust_score_changed',
    'assignment_completed', 'workflow_completed',
    'goal_created', 'goal_completed', 'goal_failed', 'plan_approved',
    'recommendation_applied',
    'integration_connected', 'integration_disconnected', 'integration_error',
    'task_output_approved',
    'organization_created', 'workforce_deployed', 'campaign_launched'
  ));

-- "Organization created" is a trigger, not a call site scattered across
-- the app, so it fires no matter which path created the row (guided
-- onboarding, /organizations/new, or a future path) rather than relying
-- on every future caller remembering to log it.
create or replace function public.trg_organizations_after_insert_activity()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_organization_activity(new.id, 'organization_created', jsonb_build_object('name', new.name, 'industry', new.industry));
  return new;
end;
$$;
drop trigger if exists organizations_after_insert_activity on public.organizations;
create trigger organizations_after_insert_activity after insert on public.organizations
  for each row execute procedure public.trg_organizations_after_insert_activity();

-- "Workforce deployed" is logged inside deploy_workforce_template() itself
-- (redefined here with the same body as 014_stabilization.sql plus one
-- new line) rather than a trigger, since "a template was deployed" is a
-- fact about this specific function's success, not a generic table
-- insert — the same organizations row could theoretically exist without
-- ever going through this deployment path.
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
  v_template_name text;
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

  select name into v_template_name from public.workforce_templates where id = p_template_id;
  perform public.log_organization_activity(v_org_id, 'workforce_deployed', jsonb_build_object('template_id', p_template_id, 'template_name', v_template_name));

  return v_org_id;
end;
$$;

-- "Campaign launched" is a distinct, human-triggered moment in
-- lib/campaigns.ts (not a table insert this schema already fires a
-- trigger on) — a small, self-authorizing RPC, same bar as
-- record_sales_activity (is_org_member, not manager — launching a
-- campaign only needs org membership, matching who can already create a
-- goal/plan today).
create or replace function public.record_campaign_launched(p_org_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  perform public.log_organization_activity(p_org_id, 'campaign_launched', p_metadata);
end;
$$;

-- "Emails drafted" reuses sales_activities exactly like lead_found /
-- email_sent / reply_received / meeting_booked already do — one more
-- activity_type, not a new ledger.
alter table public.sales_activities drop constraint if exists sales_activities_activity_type_check;
alter table public.sales_activities add constraint sales_activities_activity_type_check
  check (activity_type in ('lead_found', 'email_drafted', 'email_sent', 'reply_received', 'meeting_booked'));

-- ============================================================
-- 2. ANALYTICS READ (admin-only, same gating as get_network_health())
-- ============================================================
create or replace function public.get_analytics_funnel()
returns table (
  organizations_created bigint, workforces_deployed bigint, campaigns_launched bigint,
  emails_drafted bigint, emails_sent bigint, replies_received bigint, meetings_booked bigint
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      (select count(*) from public.organization_activity where activity_type = 'organization_created'),
      (select count(*) from public.organization_activity where activity_type = 'workforce_deployed'),
      (select count(*) from public.organization_activity where activity_type = 'campaign_launched'),
      (select count(*) from public.sales_activities where activity_type = 'email_drafted'),
      (select count(*) from public.sales_activities where activity_type = 'email_sent'),
      (select count(*) from public.sales_activities where activity_type = 'reply_received'),
      (select count(*) from public.sales_activities where activity_type = 'meeting_booked');
end;
$$;

-- Per-organization funnel breakdown — which design partners actually
-- progressed, and where each one is stuck, rather than only a network
-- total.
create or replace function public.get_analytics_by_organization()
returns table (
  organization_id uuid, organization_name text, created_at timestamptz,
  workforce_deployed boolean, campaign_launched boolean,
  emails_drafted bigint, emails_sent bigint, replies_received bigint, meetings_booked bigint
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      o.id, o.name, o.created_at,
      exists (select 1 from public.organization_activity a where a.organization_id = o.id and a.activity_type = 'workforce_deployed'),
      exists (select 1 from public.organization_activity a where a.organization_id = o.id and a.activity_type = 'campaign_launched'),
      coalesce((select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'email_drafted'), 0),
      coalesce((select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'email_sent'), 0),
      coalesce((select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'reply_received'), 0),
      coalesce((select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'meeting_booked'), 0)
    from public.organizations o
    order by o.created_at desc;
end;
$$;

-- ============================================================
-- 3. FEEDBACK SYSTEM
-- ============================================================
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  feedback_type text not null check (feedback_type in ('bug', 'feature_request', 'general')),
  message text not null,
  page_url text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_feedback_user_id_idx on public.user_feedback (user_id, created_at desc);
create index if not exists user_feedback_status_idx on public.user_feedback (status);

drop trigger if exists user_feedback_updated_at on public.user_feedback;
create trigger user_feedback_updated_at before update on public.user_feedback
  for each row execute procedure public.set_updated_at();

alter table public.user_feedback enable row level security;

-- Anyone signed in can submit and see their own feedback (no org
-- membership required — even someone stuck before creating an
-- organization should be able to report a bug or ask a question).
create policy "user_feedback_select" on public.user_feedback for select
  using (user_id = auth.uid() or public.is_admin());
create policy "user_feedback_insert" on public.user_feedback for insert
  with check (user_id = auth.uid());
-- Only an admin can change status/notes — the submitter's own message
-- shouldn't be editable after the fact, matching how a support ticket
-- normally works.
create policy "user_feedback_update" on public.user_feedback for update
  using (public.is_admin());

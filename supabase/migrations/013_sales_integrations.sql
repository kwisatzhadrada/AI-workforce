-- ============================================================
-- B2B Sales Vertical: Real Integrations (Phase 10)
-- Makes the existing B2B Sales Team workforce template produce real
-- business outcomes: real prospect data (Hunter.io), real outbound email
-- (Gmail), and a real CRM (HubSpot) — wired into the EXISTING agent /
-- task / workflow / execution machinery from Phases 1-9. No new agent
-- system, workflow system, or intelligence system is introduced here.
-- ============================================================

-- ============================================================
-- 1. INTEGRATION CREDENTIALS
-- ============================================================
-- One row per organization per connected provider. Access is restricted
-- to that organization's managers (and admins, for support) — this is
-- credential storage, not public profile data, so it does not follow the
-- "public professional network" precedent the rest of the platform uses.
create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'hubspot', 'hunter')),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  credentials jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);
create index if not exists organization_integrations_org_id_idx on public.organization_integrations (organization_id);

drop trigger if exists organization_integrations_updated_at on public.organization_integrations;
create trigger organization_integrations_updated_at before update on public.organization_integrations
  for each row execute procedure public.set_updated_at();

alter table public.organization_integrations enable row level security;
create policy "organization_integrations_select" on public.organization_integrations for select
  using (public.is_org_manager(organization_id, auth.uid()) or public.is_admin());
-- No direct insert/update/delete policy: only connect_integration()/
-- disconnect_integration() below (security definer, org-manager-gated)
-- write this table, so credentials never pass through a plain client-side
-- .insert()/.update() call.

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
end;
$$;

-- Called directly by the runtime execution layer (lib/integrations),
-- running as the acting user's own session, when a real API call to a
-- connected provider fails — so, like record_sales_activity(), it
-- authorizes itself rather than being revoked from authenticated.
create or replace function public.record_integration_error(p_org_id uuid, p_provider text, p_error text)
returns void language plpgsql security definer as $$
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.organization_integrations
  set status = 'error', last_error = left(p_error, 2000), updated_at = now()
  where organization_id = p_org_id and provider = p_provider;
end;
$$;

-- ============================================================
-- 2. SALES ACTIVITY LOG (measurement)
-- ============================================================
-- A plain event ledger, same shape as the existing task_history /
-- organization_activity tables — not a new "intelligence" concept, just
-- that same pattern applied to sales events. This is the entire source
-- of truth for Leads Found / Emails Sent / Replies Received / Meetings
-- Booked: real counts of real rows, not a derived or predicted score.
-- Kept member-scoped rather than public (matching organization_metrics'
-- precedent) because rows carry real external people's contact details.
create table if not exists public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_type text not null check (activity_type in ('lead_found', 'email_sent', 'reply_received', 'meeting_booked')),
  agent_id uuid references public.agents(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  contact_email text,
  contact_name text,
  contact_company text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sales_activities_org_type_idx on public.sales_activities (organization_id, activity_type, created_at desc);
create index if not exists sales_activities_contact_email_idx on public.sales_activities (organization_id, contact_email);

alter table public.sales_activities enable row level security;
create policy "sales_activities_select" on public.sales_activities for select
  using (public.is_org_member(organization_id, auth.uid()));

-- Unlike the internal log_task_event()/log_organization_activity()
-- writers (revoked from authenticated, only ever called from within a
-- trigger), this one is called directly by the runtime execution layer
-- running as the acting user's own session — so it authorizes itself
-- instead of being revoked from authenticated.
create or replace function public.record_sales_activity(
  p_org_id uuid, p_activity_type text, p_agent_id uuid default null, p_task_id uuid default null,
  p_contact_email text default null, p_contact_name text default null, p_contact_company text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  insert into public.sales_activities (organization_id, activity_type, agent_id, task_id, contact_email, contact_name, contact_company, metadata)
  values (p_org_id, p_activity_type, p_agent_id, p_task_id, p_contact_email, p_contact_name, p_contact_company, p_metadata)
  returning id into v_id;

  return v_id;
end;
$$;

-- Read-only rollup — RLS on sales_activities already scopes this
-- correctly per caller, so no security definer is needed.
create or replace function public.get_sales_metrics(p_org_id uuid)
returns table (leads_found bigint, emails_sent bigint, replies_received bigint, meetings_booked bigint, reply_rate numeric)
language sql stable as $$
  select
    count(*) filter (where activity_type = 'lead_found'),
    count(*) filter (where activity_type = 'email_sent'),
    count(*) filter (where activity_type = 'reply_received'),
    count(*) filter (where activity_type = 'meeting_booked'),
    case when count(*) filter (where activity_type = 'email_sent') > 0
      then round(count(*) filter (where activity_type = 'reply_received')::numeric / count(*) filter (where activity_type = 'email_sent') * 100, 2)
      else 0 end
  from public.sales_activities
  where organization_id = p_org_id;
$$;

-- ============================================================
-- 3. WIRE CAPABILITIES TO REAL ACTIONS
-- ============================================================
-- Tags an existing agent_capabilities row with which real integration
-- action the runtime should perform when this capability is executed
-- (see lib/runtime/execute.ts), instead of only calling the LLM.
alter table public.agent_capabilities add column if not exists integration_action text
  check (integration_action in ('prospect_enrich', 'email_draft_send', 'crm_upsert'));

-- deploy_workforce_template() redefined (same signature) to also copy a
-- blueprint capability's integration_action, if it declares one, onto
-- the deployed agent_capabilities row.
create or replace function public.deploy_workforce_template(
  p_template_id uuid, p_organization_name text, p_industry text default null
)
returns uuid language plpgsql as $$
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
-- 4. UPDATE THE B2B SALES TEAM TEMPLATE'S SEED DATA
-- ============================================================
-- Lead Research Agent's capability now enriches real target-company
-- domains into real people via Hunter.io.
update public.agent_blueprints ab
set capabilities = jsonb_build_array(jsonb_build_object(
  'name', 'Prospect Research',
  'description', 'Enrich target company domains into real decision-maker contacts (Hunter.io)',
  'cost_estimate', 0.5,
  'integration_action', 'prospect_enrich'
))
from public.workforce_templates t
where ab.template_id = t.id and t.name = 'B2B Sales Team' and ab.name = 'Lead Research Agent';

-- Outreach Agent's capability now drafts (LLM) and actually sends
-- (Gmail) personalized email to every real prospect the research step found.
update public.agent_blueprints ab
set capabilities = jsonb_build_array(jsonb_build_object(
  'name', 'Outreach Send',
  'description', 'Draft and send personalized outbound email to enriched prospects (Gmail)',
  'cost_estimate', 0.5,
  'integration_action', 'email_draft_send'
))
from public.workforce_templates t
where ab.template_id = t.id and t.name = 'B2B Sales Team' and ab.name = 'Outreach Agent';

-- The Follow-up Agent becomes the CRM Agent: creates/updates real HubSpot
-- contacts and logs real outreach activity against them. Renamed rather
-- than added as a fifth blueprint, since "track responses and keep CRM
-- current" is what a real follow-up agent's job already was.
update public.agent_blueprints ab
set
  name = 'CRM Agent',
  description = 'Creates and updates CRM records for every prospect contacted, and tracks responses.',
  default_prompt = 'You are a meticulous revenue-operations specialist. Keep CRM records accurate and log every real interaction with a prospect.',
  workflow_role = 'Update CRM',
  capabilities = jsonb_build_array(jsonb_build_object(
    'name', 'CRM Sync',
    'description', 'Create and update CRM contact records for contacted prospects (HubSpot)',
    'cost_estimate', 0.25,
    'integration_action', 'crm_upsert'
  ))
from public.workforce_templates t
where ab.template_id = t.id and t.name = 'B2B Sales Team' and ab.name = 'Follow-up Agent';

update public.workflow_blueprint_steps s
set name = 'Update CRM'
from public.workflow_blueprints w, public.workforce_templates t
where s.workflow_blueprint_id = w.id and w.template_id = t.id and t.name = 'B2B Sales Team' and s.name = 'Follow-up';

update public.workflow_blueprints w
set description = 'Research Prospect -> Qualify Prospect -> Outreach -> Update CRM'
from public.workforce_templates t
where w.template_id = t.id and t.name = 'B2B Sales Team' and w.name = 'Lead Generation Workflow';

-- ============================================================
-- 5. SECURITY HARDENING
-- ============================================================
-- Nothing to revoke here: every new function in this migration is
-- called directly by application code running as the acting user's own
-- session (there is no service-role client anywhere in this app — every
-- write goes through the user's own RLS-checked session, matching every
-- prior phase), so each one authorizes itself internally
-- (is_org_manager()/is_org_member()) rather than being revoked from
-- authenticated. Only trigger-only internal helpers get revoked, and
-- this migration introduces none.

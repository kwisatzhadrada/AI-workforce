-- ============================================================
-- Workforce Templates (Phase 7)
-- Deployable AI businesses: a template bundles agent blueprints,
-- a workflow blueprint, and goal blueprints, so "Deploy Sales Team"
-- creates a fully-populated organization in one call.
-- ============================================================

-- ============================================================
-- 1. TEMPLATES
-- ============================================================
create table if not exists public.workforce_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  industry text,
  goal text,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workforce_templates_industry_idx on public.workforce_templates (industry);

drop trigger if exists workforce_templates_updated_at on public.workforce_templates;
create trigger workforce_templates_updated_at before update on public.workforce_templates
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 2. AGENT BLUEPRINTS
-- ============================================================
create table if not exists public.agent_blueprints (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workforce_templates(id) on delete cascade,
  name text not null,
  description text,
  default_prompt text,
  capabilities jsonb not null default '[]'::jsonb,
  memory_defaults jsonb not null default '[]'::jsonb,
  workflow_role text,
  department_slug text,
  is_manager boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists agent_blueprints_template_id_idx on public.agent_blueprints (template_id);

-- ============================================================
-- 3. WORKFLOW BLUEPRINTS
-- ============================================================
create table if not exists public.workflow_blueprints (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workforce_templates(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists workflow_blueprints_template_id_idx on public.workflow_blueprints (template_id);

create table if not exists public.workflow_blueprint_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_blueprint_id uuid not null references public.workflow_blueprints(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  name text not null,
  agent_blueprint_id uuid references public.agent_blueprints(id) on delete set null,
  department_slug text,
  created_at timestamptz not null default now(),
  unique (workflow_blueprint_id, step_order)
);
create index if not exists workflow_blueprint_steps_wbid_idx on public.workflow_blueprint_steps (workflow_blueprint_id, step_order);

-- ============================================================
-- 4. GOAL BLUEPRINTS
-- ============================================================
create table if not exists public.goal_blueprints (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workforce_templates(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  target_metrics jsonb not null default '{}'::jsonb,
  manager_agent_blueprint_id uuid references public.agent_blueprints(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists goal_blueprints_template_id_idx on public.goal_blueprints (template_id);

-- ============================================================
-- 5. LINEAGE: trace deployed org resources back to the blueprint that spawned them
-- ============================================================
alter table public.agent_assignments add column if not exists source_agent_blueprint_id uuid references public.agent_blueprints(id) on delete set null;
alter table public.workflows add column if not exists source_workflow_blueprint_id uuid references public.workflow_blueprints(id) on delete set null;
alter table public.organization_goals add column if not exists source_goal_blueprint_id uuid references public.goal_blueprints(id) on delete set null;
create index if not exists organization_goals_source_blueprint_idx on public.organization_goals (source_goal_blueprint_id);

-- ============================================================
-- 6. DEPLOYMENTS (usage + success + goal-completion metrics)
-- ============================================================
create table if not exists public.template_deployments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workforce_templates(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  deployed_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'success' check (status in ('success', 'failed')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists template_deployments_template_id_idx on public.template_deployments (template_id, created_at desc);
create index if not exists template_deployments_deployed_by_idx on public.template_deployments (deployed_by);

create or replace function public.increment_template_usage(p_template_id uuid)
returns void language sql security definer as $$
  update public.workforce_templates set usage_count = usage_count + 1 where id = p_template_id;
$$;
revoke execute on function public.increment_template_usage(uuid) from public, anon, authenticated;

-- ============================================================
-- 7. METRICS
-- ============================================================
create or replace function public.get_template_metrics(p_template_id uuid)
returns table (
  usage_count integer,
  deployments_total bigint,
  deployments_success bigint,
  deployment_success_rate numeric,
  goals_total bigint,
  goals_completed bigint,
  goal_completion_rate numeric
)
-- security definer: these are meant to be public aggregate stats (like "94%
-- success rate across N deployments"), not filtered down to whatever
-- template_deployments/organization_goals rows the browsing user's own RLS
-- happens to make visible to them — that would silently understate the
-- numbers for anyone who isn't a participant in most deployments.
language sql security definer stable as $$
  select
    t.usage_count,
    coalesce(d.total, 0),
    coalesce(d.success, 0),
    case when coalesce(d.total, 0) > 0 then round(d.success::numeric / d.total * 100, 2) else 0 end,
    coalesce(g.total, 0),
    coalesce(g.completed, 0),
    case when coalesce(g.total, 0) > 0 then round(g.completed::numeric / g.total * 100, 2) else 0 end
  from public.workforce_templates t
  left join (
    select template_id, count(*) as total, count(*) filter (where status = 'success') as success
    from public.template_deployments group by template_id
  ) d on d.template_id = t.id
  left join (
    select gb.template_id, count(og.id) as total, count(og.id) filter (where og.status = 'completed') as completed
    from public.goal_blueprints gb
    left join public.organization_goals og on og.source_goal_blueprint_id = gb.id
    group by gb.template_id
  ) g on g.template_id = t.id
  where t.id = p_template_id;
$$;

-- ============================================================
-- 8. DEPLOYMENT ENGINE
-- ============================================================
-- Deliberately NOT security definer: the new organization is owned by the
-- caller, and every write below (agents, capabilities, assignments,
-- workflows, goals) is already something an organization's owner is allowed
-- to do to their own org under the existing RLS from Phases 1-6. If any
-- step fails, the whole deployment rolls back — nothing half-built is left
-- behind. On success it logs its own deployment record; on failure the
-- caller logs a separate 'failed' row (a rolled-back transaction can't log
-- its own failure — see README).
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
      insert into public.agent_capabilities (agent_id, name, description, cost_estimate, input_schema, output_schema)
      values (
        v_new_agent_id,
        v_cap->>'name',
        v_cap->>'description',
        coalesce((v_cap->>'cost_estimate')::numeric, 0),
        coalesce(v_cap->'input_schema', '{}'::jsonb),
        coalesce(v_cap->'output_schema', '{}'::jsonb)
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

create or replace function public.log_failed_deployment(p_template_id uuid, p_error text)
returns void language plpgsql security definer as $$
begin
  insert into public.template_deployments (template_id, organization_id, deployed_by, status, error)
  values (p_template_id, null, auth.uid(), 'failed', left(p_error, 2000));
end;
$$;

-- ============================================================
-- 9. RLS
-- ============================================================
alter table public.workforce_templates enable row level security;
alter table public.agent_blueprints enable row level security;
alter table public.workflow_blueprints enable row level security;
alter table public.workflow_blueprint_steps enable row level security;
alter table public.goal_blueprints enable row level security;
alter table public.template_deployments enable row level security;

-- Templates and their blueprints are a public catalog — anyone can browse
-- and preview; only the creator (null for system templates, meaning no one
-- but a future admin path) may edit.
create policy "workforce_templates_select" on public.workforce_templates for select using (true);
create policy "workforce_templates_insert" on public.workforce_templates for insert with check (auth.uid() = created_by);
create policy "workforce_templates_update" on public.workforce_templates for update using (auth.uid() = created_by);
create policy "workforce_templates_delete" on public.workforce_templates for delete using (auth.uid() = created_by);

create policy "agent_blueprints_select" on public.agent_blueprints for select using (true);
create policy "agent_blueprints_write" on public.agent_blueprints for all
  using (exists (select 1 from public.workforce_templates t where t.id = template_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.workforce_templates t where t.id = template_id and t.created_by = auth.uid()));

create policy "workflow_blueprints_select" on public.workflow_blueprints for select using (true);
create policy "workflow_blueprints_write" on public.workflow_blueprints for all
  using (exists (select 1 from public.workforce_templates t where t.id = template_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.workforce_templates t where t.id = template_id and t.created_by = auth.uid()));

create policy "workflow_blueprint_steps_select" on public.workflow_blueprint_steps for select using (true);
create policy "workflow_blueprint_steps_write" on public.workflow_blueprint_steps for all
  using (exists (
    select 1 from public.workflow_blueprints wb join public.workforce_templates t on t.id = wb.template_id
    where wb.id = workflow_blueprint_id and t.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.workflow_blueprints wb join public.workforce_templates t on t.id = wb.template_id
    where wb.id = workflow_blueprint_id and t.created_by = auth.uid()
  ));

create policy "goal_blueprints_select" on public.goal_blueprints for select using (true);
create policy "goal_blueprints_write" on public.goal_blueprints for all
  using (exists (select 1 from public.workforce_templates t where t.id = template_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.workforce_templates t where t.id = template_id and t.created_by = auth.uid()));

create policy "template_deployments_select" on public.template_deployments for select
  using (auth.uid() = deployed_by or (organization_id is not null and public.is_org_member(organization_id, auth.uid())));
create policy "template_deployments_insert" on public.template_deployments for insert
  with check (auth.uid() = deployed_by);

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.workforce_templates;
alter publication supabase_realtime add table public.template_deployments;

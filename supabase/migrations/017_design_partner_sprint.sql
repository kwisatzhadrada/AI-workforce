-- ============================================================
-- Design Partner Sprint
-- No new platform layer, no new architecture. This migration adds the
-- onboarding funnel (with drop-off, per the mission's exact 7 stages),
-- a platform-overview snapshot for the design partner dashboard, and two
-- support tools (a per-organization debug export and a unified activity
-- timeline) — all read-only aggregations over data that already exists
-- (organization_activity, sales_activities, agent_executions,
-- agent_decisions), gated the same way every other admin RPC in this
-- schema already is: security definer + an explicit is_admin() check.
-- ============================================================

-- ============================================================
-- 1. ONBOARDING FUNNEL (with drop-off)
-- ============================================================
-- Every stage after "Account Created" is counted as DISTINCT
-- ORGANIZATIONS that reached it, not raw event counts — a business's
-- journey is organization-scoped from stage 2 onward, and counting
-- distinct orgs is what makes a drop-off percentage meaningful ("60% of
-- organizations that deployed a workforce went on to connect an
-- integration"), not accidentally inflated by an org connecting the same
-- integration multiple times.
create or replace function public.get_onboarding_funnel()
returns table (
  accounts_created bigint,
  organizations_created bigint,
  workforces_deployed bigint,
  integrations_connected bigint,
  campaigns_created bigint,
  campaigns_approved bigint,
  first_email_sent bigint
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      (select count(*) from public.profiles),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'organization_created'),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'workforce_deployed'),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'integration_connected'),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'campaign_launched'),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'task_output_approved'),
      (select count(distinct organization_id) from public.sales_activities where activity_type = 'email_sent');
end;
$$;

-- Extends last sprint's get_analytics_by_organization() with the two
-- stages it didn't yet track (integrations connected, campaign approved)
-- so the design partner dashboard can show exactly which stage each
-- organization is currently stuck at, not just a network total.
drop function if exists public.get_analytics_by_organization();
create or replace function public.get_analytics_by_organization()
returns table (
  organization_id uuid, organization_name text, created_at timestamptz,
  workforce_deployed boolean, integrations_connected boolean, campaign_launched boolean, campaign_approved boolean,
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
      exists (select 1 from public.organization_activity a where a.organization_id = o.id and a.activity_type = 'integration_connected'),
      exists (select 1 from public.organization_activity a where a.organization_id = o.id and a.activity_type = 'campaign_launched'),
      exists (select 1 from public.organization_activity a where a.organization_id = o.id and a.activity_type = 'task_output_approved'),
      coalesce((select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'email_drafted'), 0),
      coalesce((select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'email_sent'), 0),
      coalesce((select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'reply_received'), 0),
      coalesce((select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'meeting_booked'), 0)
    from public.organizations o
    order by o.created_at desc;
end;
$$;

-- ============================================================
-- 2. DESIGN PARTNER DASHBOARD: platform overview snapshot
-- ============================================================
-- A "right now" snapshot, distinct from the historical funnel above —
-- how many organizations are actually active today, not how many ever
-- reached each stage.
create or replace function public.get_platform_overview()
returns table (
  active_organizations bigint,
  connected_integrations bigint,
  active_campaigns bigint,
  emails_sent bigint,
  replies_received bigint,
  meetings_booked bigint
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      -- "Active" = has a non-paused, non-failed campaign goal — the
      -- same real signal the Campaign Dashboard itself uses, not a new
      -- activity-recency heuristic.
      (select count(distinct g.organization_id) from public.organization_goals g where g.title = 'Generate Leads' and g.status = 'active' and not g.is_paused),
      (select count(*) from public.organization_integrations where status = 'connected'),
      (select count(*) from public.organization_goals where title = 'Generate Leads' and status = 'active' and not is_paused),
      (select count(*) from public.sales_activities where activity_type = 'email_sent'),
      (select count(*) from public.sales_activities where activity_type = 'reply_received'),
      (select count(*) from public.sales_activities where activity_type = 'meeting_booked');
end;
$$;

-- ============================================================
-- 3. SUPPORT TOOLS
-- ============================================================
-- A single JSON snapshot of one organization's state, for debugging a
-- specific design partner's issue without needing five separate manual
-- queries. Read-only, admin-gated, no new tables.
create or replace function public.get_organization_debug_export(p_org_id uuid)
returns jsonb
language plpgsql security definer stable as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'organization', (select to_jsonb(o) from public.organizations o where o.id = p_org_id),
    'integrations', (select coalesce(jsonb_agg(to_jsonb(i) - 'credentials'), '[]'::jsonb) from public.organization_integrations i where i.organization_id = p_org_id),
    'agents', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'status', a.status)), '[]'::jsonb)
               from public.agents a join public.agent_assignments aa on aa.agent_id = a.id where aa.organization_id = p_org_id),
    'campaign_goal', (select to_jsonb(g) from public.organization_goals g where g.organization_id = p_org_id and g.title = 'Generate Leads' order by g.created_at desc limit 1),
    'tasks', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', t.id, 'title', t.title, 'status', t.status, 'assigned_agent_id', t.assigned_agent_id,
                'requires_approval', t.requires_approval, 'approved_at', t.approved_at, 'output_keys', (select jsonb_agg(k) from jsonb_object_keys(t.output) k)
              )), '[]'::jsonb)
             from public.tasks t where t.organization_id = p_org_id),
    'recent_executions', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', e.id, 'status', e.status, 'error', e.error, 'created_at', e.created_at
              ) order by e.created_at desc), '[]'::jsonb)
             from (select e2.id, e2.status, e2.error, e2.created_at from public.agent_executions e2
                   join public.tasks t2 on t2.id = e2.task_id
                   where t2.organization_id = p_org_id order by e2.created_at desc limit 20) e),
    'sales_metrics', (select to_jsonb(m) from public.get_sales_metrics(p_org_id) m),
    'recent_activity', (select coalesce(jsonb_agg(jsonb_build_object(
                'activity_type', a.activity_type, 'payload', a.payload, 'created_at', a.created_at
              ) order by a.created_at desc), '[]'::jsonb)
             from (select * from public.organization_activity a2 where a2.organization_id = p_org_id order by a2.created_at desc limit 30) a),
    'open_feedback', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', f.id, 'feedback_type', f.feedback_type, 'message', f.message, 'status', f.status, 'created_at', f.created_at
              )), '[]'::jsonb)
             from public.user_feedback f where f.organization_id = p_org_id and f.status in ('open', 'in_progress'))
  ) into v_result;

  return v_result;
end;
$$;

-- A unified, chronological timeline for one organization — organization
-- events, sales pipeline events, and assignment/completion decisions —
-- normalized into one shape instead of three separate queries a support
-- person would otherwise have to run and mentally interleave by hand.
create or replace function public.get_organization_timeline(p_org_id uuid, p_limit integer default 100)
returns table (source text, event_type text, detail jsonb, created_at timestamptz)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() and not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select 'organization'::text, a.activity_type, a.payload, a.created_at
    from public.organization_activity a where a.organization_id = p_org_id
    union all
    select 'sales'::text, s.activity_type, jsonb_build_object('contact_email', s.contact_email, 'contact_name', s.contact_name, 'contact_company', s.contact_company) || s.metadata, s.created_at
    from public.sales_activities s where s.organization_id = p_org_id
    union all
    select 'decision'::text, d.decision_type || ':' || d.outcome, jsonb_build_object('reasoning', d.reasoning), d.created_at
    from public.agent_decisions d
    join public.tasks t on t.id = d.task_id
    where t.organization_id = p_org_id
    order by created_at desc
    limit p_limit;
end;
$$;

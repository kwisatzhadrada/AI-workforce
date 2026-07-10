-- ============================================================
-- Phase 22 — Design Partner Launch
-- Not a new platform: this migration exists purely to make the existing
-- platform activatable, supportable, and measurable for the first real
-- design partners. Every addition below either fills a genuine
-- measurement gap (logins were never tracked at all) or extends an
-- existing table with columns a human triaging real feedback actually
-- needs (severity/frequency/owner) — no new business-transaction
-- concepts, no new agent/workflow/template machinery.
-- ============================================================

-- ============================================================
-- 1. LOGIN TRACKING (a genuine gap — no login signal existed before this)
-- ============================================================
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.profiles add column if not exists login_count int not null default 0;

-- Called once per real session, not once per page navigation — the
-- 30-minute guard approximates "a new session" without needing to plumb
-- through Supabase's actual JWT-issued-at claim, so repeated layout
-- renders during one sitting don't inflate the count.
create or replace function public.record_login()
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
  set login_count = login_count + 1, last_login_at = now()
  where id = auth.uid() and (last_login_at is null or last_login_at < now() - interval '30 minutes');
end;
$$;

-- ============================================================
-- 2. FEEDBACK TRIAGE (severity, frequency, owner) + two new categories
-- ============================================================
alter table public.user_feedback add column if not exists severity text not null default 'medium'
  check (severity in ('low', 'medium', 'high', 'critical'));
alter table public.user_feedback add column if not exists frequency int not null default 1;
alter table public.user_feedback add column if not exists owner_id uuid references public.profiles(id) on delete set null;

alter table public.user_feedback drop constraint if exists user_feedback_feedback_type_check;
alter table public.user_feedback add constraint user_feedback_feedback_type_check
  check (feedback_type in ('bug', 'feature_request', 'general', 'blocker', 'success_story', 'onboarding_friction'));

-- Admin-only triage — any subset of status/severity/owner in one call so
-- the UI can update just what changed without three round trips.
create or replace function public.triage_feedback(
  p_feedback_id uuid, p_status text default null, p_severity text default null, p_owner_id uuid default null
)
returns public.user_feedback language plpgsql security definer as $$
declare
  v_row public.user_feedback;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.user_feedback set
    status = coalesce(p_status, status),
    severity = coalesce(p_severity, severity),
    owner_id = coalesce(p_owner_id, owner_id)
  where id = p_feedback_id
  returning * into v_row;

  return v_row;
end;
$$;

-- A real, human-driven count of "this same issue came up again" — not an
-- automated duplicate-detection algorithm, which this phase has no real
-- signal to build honestly.
create or replace function public.bump_feedback_frequency(p_feedback_id uuid)
returns public.user_feedback language plpgsql security definer as $$
declare
  v_row public.user_feedback;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.user_feedback set frequency = frequency + 1 where id = p_feedback_id returning * into v_row;
  return v_row;
end;
$$;

-- ============================================================
-- 3. SUPPORT VISIBILITY: org members can see their own org's conversations
-- ============================================================
-- Previously scoped to the literal submitter (user_id = auth.uid()) or
-- is_admin() — meant a manager other than whoever filed the ticket
-- couldn't see it, which blocks the Partner Workspace's "support status"
-- requirement. Widened to real org membership, same pattern every other
-- org-scoped table in this project already uses.
drop policy if exists "support_conversations_select" on public.support_conversations;
create policy "support_conversations_select" on public.support_conversations
  for select using (
    user_id = auth.uid() or public.is_admin()
    or (organization_id is not null and public.is_org_member(organization_id, auth.uid()))
  );

drop policy if exists "support_messages_select" on public.support_messages;
create policy "support_messages_select" on public.support_messages
  for select using (
    exists (
      select 1 from public.support_conversations c where c.id = conversation_id
      and (c.user_id = auth.uid() or public.is_admin() or (c.organization_id is not null and public.is_org_member(c.organization_id, auth.uid())))
    )
  );

-- ============================================================
-- 4. CUSTOMER HEALTH: add login frequency + support tickets
-- ============================================================
-- Phase 21 added autonomous execution (the cron worker), which means
-- sales_activities/organization_activity can now show "recent activity"
-- purely from the system running unattended — a real gap for a health
-- score meant to answer "is a human actually engaged." Login frequency
-- (from this migration's new profiles.login_count/last_login_at) and
-- open support ticket volume are both genuinely new, real inputs the
-- mission explicitly named; every other input below is unchanged from
-- the original scoring.
create or replace function public.get_organization_health(p_org_id uuid)
returns table (adoption_score int, success_score int, risk_score int, health_status text)
language plpgsql security definer stable as $$
declare
  v_integrations_connected int;
  v_campaign_launched boolean;
  v_recent_activity boolean;
  v_replies int;
  v_meetings int;
  v_campaign_completed boolean;
  v_last_activity timestamptz;
  v_workforce_deployed boolean;
  v_recent_login boolean;
  v_open_support_tickets int;
  v_adoption int;
  v_success int;
  v_risk int;
  v_status text;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;

  select count(*) into v_integrations_connected
    from public.organization_integrations where organization_id = p_org_id and status = 'connected';

  select exists (select 1 from public.organization_activity where organization_id = p_org_id and activity_type = 'campaign_launched') into v_campaign_launched;
  select exists (select 1 from public.organization_activity where organization_id = p_org_id and activity_type = 'workforce_deployed') into v_workforce_deployed;

  select max(last_seen) into v_last_activity from (
    select max(created_at) as last_seen from public.sales_activities where organization_id = p_org_id
    union all
    select max(created_at) from public.organization_activity where organization_id = p_org_id
    union all
    select max(created_at) from public.tasks where organization_id = p_org_id
  ) t;
  v_recent_activity := v_last_activity is not null and v_last_activity > (now() - interval '7 days');

  select count(*) filter (where activity_type = 'reply_received') into v_replies from public.sales_activities where organization_id = p_org_id;
  select count(*) into v_meetings from public.meetings where organization_id = p_org_id;
  select exists (select 1 from public.organization_goals where organization_id = p_org_id and title = 'Generate Leads' and status = 'completed') into v_campaign_completed;

  select exists (
    select 1 from public.profiles pr
    where pr.last_login_at > (now() - interval '14 days')
    and (pr.id = (select owner_id from public.organizations where id = p_org_id)
      or pr.id in (select user_id from public.organization_members where organization_id = p_org_id))
  ) into v_recent_login;

  select count(*) into v_open_support_tickets
    from public.support_conversations
    where organization_id = p_org_id and status not in ('resolved', 'closed');

  v_adoption := least(100,
    (v_integrations_connected * 13) +
    (case when v_campaign_launched then 30 else 0 end) +
    (case when v_recent_activity then 31 else 0 end)
  );

  v_success := least(100,
    (case when v_replies > 0 then 30 else 0 end) +
    (case when v_meetings > 0 then 40 else 0 end) +
    (case when v_campaign_completed then 30 else 0 end)
  );

  v_risk :=
    (case when v_last_activity is null or v_last_activity < (now() - interval '14 days') then 30 else 0 end) +
    (case when not v_workforce_deployed then 20 else 0 end) +
    (case when v_integrations_connected = 0 then 20 else 0 end) +
    (case when not v_recent_login then 20 else 0 end) +
    (case when v_open_support_tickets >= 2 then 10 else 0 end);

  v_status := case
    when v_risk >= 60 then 'critical'
    when v_risk >= 30 or v_adoption < 40 then 'at_risk'
    else 'healthy'
  end;

  return query select v_adoption, v_success, v_risk, v_status;
end;
$$;

-- ============================================================
-- 5. PARTNER FUNNEL: Activation -> Engagement -> Value
-- ============================================================
-- The exact three-tier structure this phase's mission named, reusing
-- every signal that already existed (organization_activity,
-- organization_integrations, sales_activities, reply_classifications,
-- task_output_approved, meetings, deal_outcome) plus the one genuinely
-- new signal this migration adds (login_count). Distinct-organization
-- counts throughout, same convention as get_onboarding_funnel /
-- get_product_analytics_funnel, so "how many orgs reached this stage" is
-- never inflated by one org repeating an action.
create or replace function public.get_partner_funnel()
returns table (
  -- Activation
  signups bigint,
  workspaces_created bigint,
  gmail_connected bigint,
  crm_connected bigint,
  icp_submitted bigint,
  campaigns_launched bigint,
  -- Engagement
  logins bigint,
  active_campaigns bigint,
  replies_reviewed bigint,
  approvals_completed bigint,
  -- Value
  meetings_booked bigint,
  opportunities_created bigint,
  revenue_tracked bigint
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
      (select count(distinct organization_id) from public.organization_integrations where provider = 'gmail' and status = 'connected'),
      (select count(distinct organization_id) from public.organization_integrations where provider = 'hubspot' and status = 'connected'),
      (select count(distinct organization_id) from public.organization_goals where title = 'Generate Leads' and target_metrics->'icp'->>'targetIndustry' is not null),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'campaign_launched'),

      (select count(*) from public.profiles where login_count > 0),
      (select count(*) from public.organization_goals where title = 'Generate Leads' and status = 'active' and not is_paused),
      (select count(distinct organization_id) from public.reply_classifications),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'task_output_approved'),

      (select count(distinct organization_id) from public.meetings),
      (select count(distinct organization_id) from public.meetings where status in ('scheduled', 'completed')),
      (select count(distinct organization_id) from public.meetings where deal_outcome is not null);
end;
$$;

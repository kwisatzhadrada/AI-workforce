-- ============================================================
-- Phase 19 — Design Partner Execution & Real World Validation
-- Mission is explicit: prove real business outcomes for real design
-- partners, not build more platform. Nearly everything here is either
-- (a) a small, honestly-justified new table for a genuinely new concept
-- (a mutable subscription/support/report record, not a fact an append-
-- only ledger can represent), or (b) a read-only aggregation RPC over
-- data that already exists. The one hard constraint carried through
-- every section: "Business Outcomes" must show real measured values —
-- no multiplication-based estimates, no AI scoring, no predictions.
-- ============================================================

-- ============================================================
-- 1. DESIGN PARTNER OPERATIONS CENTER
-- ============================================================
alter table public.organizations add column if not exists company_size text;

-- The funnel-shaped status this phase asks for replaces the coarser
-- active/paused/churned from the Revenue Engine Sprint — remapped below
-- so no existing row is left in an invalid state.
alter table public.design_partners drop constraint if exists design_partners_status_check;
update public.design_partners set status = 'active_user' where status = 'active';
update public.design_partners set status = 'prospect' where status = 'paused';
alter table public.design_partners add constraint design_partners_status_check
  check (status in ('prospect', 'contacted', 'demo_scheduled', 'trial_active', 'active_user', 'paying_customer', 'churned'));
alter table public.design_partners alter column status set default 'prospect';

-- Three distinct note categories instead of one freeform field — kept as
-- plain columns (not a notes table) since each is a single running log a
-- human edits directly, matching this table's existing shape.
alter table public.design_partners rename column notes to feedback_notes;
alter table public.design_partners add column if not exists meeting_notes text;

-- ============================================================
-- 2. SESSION RECORDING (real journey milestones, not client-side capture)
-- ============================================================
-- "Session recording" here means: replay the real, already-logged
-- timestamps of the milestones that matter, in order. No new event
-- pipeline, no client-side tracking script — every one of these events
-- was already being logged by a prior sprint; this just assembles them
-- into one ordered timeline per organization.
create or replace function public.get_organization_journey(p_org_id uuid)
returns table (milestone text, occurred_at timestamptz)
language plpgsql security definer stable as $$
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  return query
    select * from (
      select 'signup' as milestone, p.created_at as occurred_at
      from public.organizations o join public.profiles p on p.id = o.owner_id
      where o.id = p_org_id
      union all
      select 'template_deployed', min(a.created_at) from public.organization_activity a
        where a.organization_id = p_org_id and a.activity_type = 'workforce_deployed'
      union all
      select 'gmail_connected', min(a.created_at) from public.organization_activity a
        where a.organization_id = p_org_id and a.activity_type = 'integration_connected' and a.payload->>'provider' = 'gmail'
      union all
      select 'campaign_launched', min(a.created_at) from public.organization_activity a
        where a.organization_id = p_org_id and a.activity_type = 'campaign_launched'
      union all
      select 'first_email_approved', min(a.created_at) from public.organization_activity a
        where a.organization_id = p_org_id and a.activity_type = 'task_output_approved'
      union all
      select 'first_reply_received', min(s.created_at) from public.sales_activities s
        where s.organization_id = p_org_id and s.activity_type = 'reply_received'
      union all
      select 'first_meeting_booked', min(m.created_at) from public.meetings m
        where m.organization_id = p_org_id
    ) journey
    order by occurred_at asc nulls last;
end;
$$;

-- ============================================================
-- 3. CUSTOMER HEALTH SCORES
-- ============================================================
-- Every input is a real, already-tracked signal (integrations, campaign
-- activity, replies, meetings, recency) — the scores are a documented,
-- fixed formula over those signals, not a model or a guess.
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
  v_adoption int;
  v_success int;
  v_risk int;
  v_status text;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
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

  -- Adoption: how much of the product is actually wired up and being used.
  v_adoption := least(100,
    (v_integrations_connected * 13) +
    (case when v_campaign_launched then 30 else 0 end) +
    (case when v_recent_activity then 31 else 0 end)
  );

  -- Success: is it actually producing outcomes.
  v_success := least(100,
    (case when v_replies > 0 then 30 else 0 end) +
    (case when v_meetings > 0 then 40 else 0 end) +
    (case when v_campaign_completed then 30 else 0 end)
  );

  -- Risk: concrete warning signs, each independent of the others.
  v_risk :=
    (case when v_last_activity is null or v_last_activity < (now() - interval '14 days') then 40 else 0 end) +
    (case when not v_workforce_deployed then 30 else 0 end) +
    (case when v_integrations_connected = 0 then 30 else 0 end);

  v_status := case
    when v_risk >= 60 then 'critical'
    when v_risk >= 30 or v_adoption < 40 then 'at_risk'
    else 'healthy'
  end;

  return query select v_adoption, v_success, v_risk, v_status;
end;
$$;

-- ============================================================
-- 4. FIRST REVENUE TRACKING
-- ============================================================
-- These are real, human-logged business facts (an admin telling the
-- system "this design partner started paying us $X/mo today"), the same
-- pattern as meetings/avg_deal_value before it — not a payment gateway
-- and not automated billing. Admin-only end to end: this is internal
-- financial data, never shown to the organization itself.
create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in ('trial_started', 'subscription_started', 'subscription_cancelled', 'upgrade', 'downgrade')),
  amount numeric(14,2),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists revenue_events_org_id_idx on public.revenue_events (organization_id, created_at desc);

alter table public.revenue_events enable row level security;
create policy "revenue_events_select" on public.revenue_events for select using (public.is_admin());

create or replace function public.record_revenue_event(p_org_id uuid, p_event_type text, p_amount numeric default null, p_notes text default null)
returns public.revenue_events language plpgsql security definer as $$
declare
  v_row public.revenue_events;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_event_type not in ('trial_started', 'subscription_started', 'subscription_cancelled', 'upgrade', 'downgrade') then
    raise exception 'invalid event_type %', p_event_type;
  end if;

  insert into public.revenue_events (organization_id, event_type, amount, notes, created_by)
  values (p_org_id, p_event_type, p_amount, p_notes, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- Latest revenue_event per org drives whether it currently counts as an
-- active, paying subscription — an upgrade/downgrade changes the
-- amount without ending the subscription; a cancellation ends it.
create or replace function public.get_revenue_metrics()
returns table (mrr numeric, arr numeric, active_customers bigint, churned_last_30d bigint, churn_rate_pct numeric)
language plpgsql security definer stable as $$
declare
  v_mrr numeric;
  v_active bigint;
  v_churned bigint;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with latest as (
    select distinct on (organization_id) organization_id, event_type, amount, created_at
    from public.revenue_events
    order by organization_id, created_at desc
  )
  select coalesce(sum(amount), 0), count(*) into v_mrr, v_active
  from latest where event_type in ('subscription_started', 'upgrade', 'downgrade');

  select count(*) into v_churned
  from public.revenue_events
  where event_type = 'subscription_cancelled' and created_at > now() - interval '30 days';

  return query select
    v_mrr,
    v_mrr * 12,
    v_active,
    v_churned,
    case when (v_active + v_churned) > 0 then round(v_churned::numeric / (v_active + v_churned) * 100, 2) else 0 end;
end;
$$;

-- ============================================================
-- 5. INTERCOM-LIKE IN-APP SUPPORT
-- ============================================================
-- A real back-and-forth thread needed a shape user_feedback (one row per
-- submission, no reply) can't represent — a conversation with messages,
-- not a ticket with a status. Kept alongside user_feedback rather than
-- replacing it, since bug/feature "fire and forget" reports still fit
-- that simpler shape fine.
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  category text not null default 'question' check (category in ('question', 'bug', 'feature_request')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_conversations_user_id_idx on public.support_conversations (user_id, created_at desc);
create index if not exists support_conversations_status_idx on public.support_conversations (status);

drop trigger if exists support_conversations_updated_at on public.support_conversations;
create trigger support_conversations_updated_at before update on public.support_conversations
  for each row execute procedure public.set_updated_at();

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_conversation_id_idx on public.support_messages (conversation_id, created_at asc);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

create policy "support_conversations_select" on public.support_conversations
  for select using (user_id = auth.uid() or public.is_admin());

create policy "support_messages_select" on public.support_messages
  for select using (
    exists (select 1 from public.support_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or public.is_admin()))
  );

create or replace function public.create_support_conversation(p_org_id uuid, p_subject text, p_category text, p_body text)
returns public.support_conversations language plpgsql security definer as $$
declare
  v_conv public.support_conversations;
begin
  if p_category not in ('question', 'bug', 'feature_request') then
    raise exception 'invalid category %', p_category;
  end if;
  if p_org_id is not null and not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  insert into public.support_conversations (organization_id, user_id, subject, category)
  values (p_org_id, auth.uid(), p_subject, p_category)
  returning * into v_conv;

  insert into public.support_messages (conversation_id, sender_id, sender_role, body)
  values (v_conv.id, auth.uid(), 'user', p_body);

  return v_conv;
end;
$$;

create or replace function public.post_support_message(p_conversation_id uuid, p_body text)
returns public.support_messages language plpgsql security definer as $$
declare
  v_conv public.support_conversations;
  v_row public.support_messages;
  v_role text;
begin
  select * into v_conv from public.support_conversations where id = p_conversation_id;
  if v_conv.id is null then
    raise exception 'conversation not found';
  end if;

  if v_conv.user_id = auth.uid() then
    v_role := 'user';
  elsif public.is_admin() then
    v_role := 'admin';
  else
    raise exception 'not authorized';
  end if;

  insert into public.support_messages (conversation_id, sender_id, sender_role, body)
  values (p_conversation_id, auth.uid(), v_role, p_body)
  returning * into v_row;

  update public.support_conversations set updated_at = now() where id = p_conversation_id;

  return v_row;
end;
$$;

create or replace function public.update_support_conversation(p_conversation_id uuid, p_status text default null, p_priority text default null)
returns public.support_conversations language plpgsql security definer as $$
declare
  v_row public.support_conversations;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status is not null and p_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'invalid status %', p_status;
  end if;
  if p_priority is not null and p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'invalid priority %', p_priority;
  end if;

  update public.support_conversations set
    status = coalesce(p_status, status),
    priority = coalesce(p_priority, priority)
  where id = p_conversation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'conversation not found';
  end if;

  return v_row;
end;
$$;

-- ============================================================
-- 6. AUTOMATED DESIGN PARTNER REPORTS (admin-only, distinct from the
-- customer-facing organization_reports — this one carries drop-off/
-- complaint content that should never reach the design partner itself)
-- ============================================================
create table if not exists public.design_partner_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  content jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists design_partner_reports_org_id_idx on public.design_partner_reports (organization_id, created_at desc);

alter table public.design_partner_reports enable row level security;
create policy "design_partner_reports_select" on public.design_partner_reports for select using (public.is_admin());

create or replace function public.generate_design_partner_report(p_org_id uuid)
returns public.design_partner_reports language plpgsql security definer as $$
declare
  v_period_start timestamptz := now() - interval '7 days';
  v_period_end timestamptz := now();
  v_health record;
  v_metrics record;
  v_journey jsonb;
  v_requested_features text;
  v_complaints int;
  v_blockers jsonb;
  v_row public.design_partner_reports;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_health from public.get_organization_health(p_org_id);

  select
    count(*) filter (where activity_type = 'lead_found') as leads_found,
    count(*) filter (where activity_type = 'email_sent') as emails_sent,
    count(*) filter (where activity_type = 'reply_received') as replies_received
  into v_metrics
  from public.sales_activities
  where organization_id = p_org_id and created_at between v_period_start and v_period_end;

  select coalesce(jsonb_agg(jsonb_build_object('milestone', milestone, 'occurred_at', occurred_at)), '[]'::jsonb)
    into v_journey from public.get_organization_journey(p_org_id);

  select requested_features into v_requested_features from public.design_partners where organization_id = p_org_id;

  select count(*) into v_complaints from public.user_feedback
    where organization_id = p_org_id and feedback_type = 'bug' and created_at between v_period_start and v_period_end;

  select coalesce(jsonb_agg(jsonb_build_object('reason', blocker_reason, 'message', message)), '[]'::jsonb)
    into v_blockers from public.user_feedback
    where organization_id = p_org_id and feedback_type = 'blocker' and created_at between v_period_start and v_period_end;

  insert into public.design_partner_reports (organization_id, period_start, period_end, generated_by, content)
  values (
    p_org_id, v_period_start, v_period_end, auth.uid(),
    jsonb_build_object(
      'adoption_score', v_health.adoption_score,
      'success_score', v_health.success_score,
      'risk_score', v_health.risk_score,
      'health_status', v_health.health_status,
      'leads_found', coalesce(v_metrics.leads_found, 0),
      'emails_sent', coalesce(v_metrics.emails_sent, 0),
      'replies_received', coalesce(v_metrics.replies_received, 0),
      'journey', v_journey,
      'requested_features', v_requested_features,
      'complaints_this_period', v_complaints,
      'blockers_this_period', v_blockers
    )
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- 7. REAL ROI PROOF — "Business Outcomes": measured values only.
-- No estimates, no scoring, no predictions in this function.
-- ============================================================
create or replace function public.get_business_outcomes(p_org_id uuid)
returns table (
  meetings_booked bigint,
  opportunities_created bigint,
  positive_replies bigint,
  pipeline_generated numeric
)
language plpgsql security definer stable as $$
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  return query
    select
      -- Booked = every meeting ever logged, regardless of what happened next.
      (select count(*) from public.meetings where organization_id = p_org_id),
      -- An opportunity is only real once it's actually on a calendar.
      (select count(*) from public.meetings where organization_id = p_org_id and status in ('scheduled', 'completed')),
      -- A reply that produced a real meeting is an objectively positive outcome —
      -- not a sentiment guess.
      (select count(distinct s.contact_email) from public.sales_activities s
        where s.organization_id = p_org_id and s.activity_type = 'reply_received'
        and s.contact_email in (select contact_email from public.meetings where organization_id = p_org_id)),
      -- Sum of real, human-entered meeting values only — never a
      -- multiplication-based estimate (that lives in get_sales_metrics'
      -- estimated_pipeline_value instead, clearly labeled as an estimate).
      (select coalesce(sum(estimated_value), 0) from public.meetings
        where organization_id = p_org_id and status in ('scheduled', 'completed') and estimated_value is not null);
end;
$$;

-- ============================================================
-- 8. DESIGN PARTNER COHORT: which orgs are being run as design partners
-- ============================================================
create or replace function public.get_design_partner_cohort()
returns table (
  organization_id uuid,
  organization_name text,
  organizations_created bigint,
  campaigns_launched bigint,
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
      o.id, o.name,
      (select count(*) from public.organizations o2 where o2.owner_id = o.owner_id),
      (select count(*) from public.organization_activity a where a.organization_id = o.id and a.activity_type = 'campaign_launched'),
      (select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'email_sent'),
      (select count(*) from public.sales_activities s where s.organization_id = o.id and s.activity_type = 'reply_received'),
      (select count(*) from public.meetings m where m.organization_id = o.id)
    from public.organizations o
    join public.design_partners dp on dp.organization_id = o.id
    order by dp.created_at asc;
end;
$$;

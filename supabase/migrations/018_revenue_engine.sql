-- ============================================================
-- Real Customer Value & Revenue Engine Sprint
-- "No new platform layers/architecture" is read as: no new agent/
-- workflow/task primitives, no new autonomous systems. What this
-- migration adds are the few genuinely new, explicitly-requested,
-- customer-facing concepts that cannot be represented by the existing
-- append-only event logs: a real meeting LIFECYCLE (mutable status,
-- not a point-in-time fact), per-organization customer success reports,
-- and an internal design-partner CRM. Everything else (the Business
-- Dashboard, CEO Mode, Campaign Command Center, product analytics) is
-- read-only aggregation over data that already exists.
-- ============================================================

-- ============================================================
-- 1. MEETING LIFECYCLE
-- ============================================================
-- Before this sprint, "a meeting was booked" was a single point-in-time
-- sales_activities row — honest for counting, but a real meeting has a
-- lifecycle (requested, then a time is set, then it happens or falls
-- through) that an append-only ledger can't represent as one mutable
-- fact. This table exists alongside sales_activities, not instead of
-- it: creating a meeting still logs one 'meeting_booked' sales_activity
-- (so every existing metric/funnel built on that signal keeps working
-- unchanged), and this table carries the richer lifecycle on top.
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  contact_email text not null,
  contact_name text,
  contact_company text,
  status text not null default 'requested' check (status in ('requested', 'scheduled', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  estimated_value numeric(14,2),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_org_id_idx on public.meetings (organization_id, created_at desc);

drop trigger if exists meetings_updated_at on public.meetings;
create trigger meetings_updated_at before update on public.meetings
  for each row execute procedure public.set_updated_at();

alter table public.meetings enable row level security;
create policy "meetings_select" on public.meetings for select using (public.is_org_member(organization_id, auth.uid()));
-- No direct write policy: only the RPCs below (security definer) write here.

create or replace function public.create_meeting(
  p_org_id uuid, p_contact_email text, p_contact_name text default null,
  p_contact_company text default null, p_task_id uuid default null, p_estimated_value numeric default null
)
returns public.meetings language plpgsql security definer as $$
declare
  v_row public.meetings;
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  insert into public.meetings (organization_id, contact_email, contact_name, contact_company, task_id, estimated_value, created_by)
  values (p_org_id, p_contact_email, p_contact_name, p_contact_company, p_task_id, p_estimated_value, auth.uid())
  returning * into v_row;

  -- Keep every existing meetings_booked-based metric (get_sales_metrics,
  -- the onboarding/analytics funnels) working unchanged — a meeting is
  -- "booked" for those purposes the moment it's created, regardless of
  -- which lifecycle status it then moves through.
  perform public.record_sales_activity(p_org_id, 'meeting_booked', null, p_task_id, p_contact_email, p_contact_name, p_contact_company, '{}'::jsonb);

  return v_row;
end;
$$;

create or replace function public.update_meeting_status(p_meeting_id uuid, p_status text, p_scheduled_at timestamptz default null)
returns public.meetings language plpgsql security definer as $$
declare
  v_row public.meetings;
begin
  select * into v_row from public.meetings where id = p_meeting_id;
  if v_row.id is null then
    raise exception 'meeting not found';
  end if;
  if not public.is_org_member(v_row.organization_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_status not in ('requested', 'scheduled', 'completed', 'cancelled') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.meetings set
    status = p_status,
    scheduled_at = case when p_status = 'scheduled' then coalesce(p_scheduled_at, scheduled_at, now()) else scheduled_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
  where id = p_meeting_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.get_meeting_funnel(p_org_id uuid)
returns table (requested bigint, scheduled bigint, completed bigint, cancelled bigint, total bigint)
language sql stable as $$
  select
    count(*) filter (where status = 'requested'),
    count(*) filter (where status = 'scheduled'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'cancelled'),
    count(*)
  from public.meetings where organization_id = p_org_id;
$$;

-- ============================================================
-- 2. CRM SYNC AS A REAL EVENT, NOT JUST A TASK-OUTPUT ARRAY
-- ============================================================
-- "CRM Agent updated 58 contacts" needs to be countable the same honest
-- way "Research Agent found 87 leads" already is — a per-event ledger,
-- not summing an array on whichever task happened to run most recently
-- (which would silently reset every time a fresh CRM Sync task runs).
alter table public.sales_activities drop constraint if exists sales_activities_activity_type_check;
alter table public.sales_activities add constraint sales_activities_activity_type_check
  check (activity_type in ('lead_found', 'email_drafted', 'email_sent', 'reply_received', 'meeting_booked', 'contact_synced'));

-- ============================================================
-- 3. CUSTOMER SUCCESS REPORTS (per organization, not admin-only)
-- ============================================================
-- Deliberately a new, separate table from system_reports (Phase 8) —
-- that table is platform-wide and admin-only (network health, autonomy
-- score), a different audience and a different trust boundary than a
-- report generated FOR a design partner about THEIR OWN campaign.
create table if not exists public.organization_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_type text not null check (report_type in ('weekly', 'monthly', 'quarterly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  content jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists organization_reports_org_id_idx on public.organization_reports (organization_id, created_at desc);

alter table public.organization_reports enable row level security;
create policy "organization_reports_select" on public.organization_reports for select using (public.is_org_member(organization_id, auth.uid()));

create or replace function public.generate_organization_report(p_org_id uuid, p_report_type text)
returns public.organization_reports language plpgsql security definer as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz := now();
  v_metrics record;
  v_meetings record;
  v_recommendations jsonb := '[]'::jsonb;
  v_row public.organization_reports;
  v_hubspot_connected boolean;
begin
  if not public.is_org_supervisor(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_report_type not in ('weekly', 'monthly', 'quarterly') then
    raise exception 'invalid report_type %', p_report_type;
  end if;

  v_period_start := case p_report_type
    when 'weekly' then v_period_end - interval '7 days'
    when 'monthly' then v_period_end - interval '30 days'
    else v_period_end - interval '90 days'
  end;

  select
    count(*) filter (where activity_type = 'lead_found') as leads_found,
    count(*) filter (where activity_type = 'email_sent') as emails_sent,
    count(*) filter (where activity_type = 'reply_received') as replies_received,
    count(*) filter (where activity_type = 'meeting_booked') as meetings_booked
  into v_metrics
  from public.sales_activities
  where organization_id = p_org_id and created_at between v_period_start and v_period_end;

  select requested, scheduled, completed, cancelled into v_meetings from public.get_meeting_funnel(p_org_id);

  select exists (select 1 from public.organization_integrations where organization_id = p_org_id and provider = 'hubspot' and status = 'connected') into v_hubspot_connected;

  if not v_hubspot_connected then
    v_recommendations := v_recommendations || jsonb_build_array('Connect HubSpot to keep your CRM automatically up to date.');
  end if;
  if coalesce(v_metrics.emails_sent, 0) > 0 and coalesce(v_metrics.replies_received, 0)::numeric / v_metrics.emails_sent < 0.05 then
    v_recommendations := v_recommendations || jsonb_build_array('Reply rate is under 5% this period — consider expanding or refining your ICP targeting.');
  end if;
  if coalesce(v_metrics.leads_found, 0) > 0 and coalesce(v_metrics.emails_sent, 0) = 0 then
    v_recommendations := v_recommendations || jsonb_build_array('You have prospects waiting — draft and approve outreach to start converting them.');
  end if;

  insert into public.organization_reports (organization_id, report_type, period_start, period_end, generated_by, content)
  values (
    p_org_id, p_report_type, v_period_start, v_period_end, auth.uid(),
    jsonb_build_object(
      'leads_found', coalesce(v_metrics.leads_found, 0),
      'emails_sent', coalesce(v_metrics.emails_sent, 0),
      'replies_received', coalesce(v_metrics.replies_received, 0),
      'meetings_booked', coalesce(v_metrics.meetings_booked, 0),
      'meetings_requested', coalesce(v_meetings.requested, 0),
      'meetings_scheduled', coalesce(v_meetings.scheduled, 0),
      'meetings_completed', coalesce(v_meetings.completed, 0),
      'meetings_cancelled', coalesce(v_meetings.cancelled, 0),
      'recommendations', v_recommendations
    )
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- 4. FEEDBACK: "what's stopping you from getting value"
-- ============================================================
alter table public.user_feedback drop constraint if exists user_feedback_feedback_type_check;
alter table public.user_feedback add constraint user_feedback_feedback_type_check
  check (feedback_type in ('bug', 'feature_request', 'general', 'blocker'));

alter table public.user_feedback add column if not exists blocker_reason text
  check (blocker_reason in ('confusing_workflow', 'poor_leads', 'no_replies', 'integrations', 'missing_features', 'other'));

-- ============================================================
-- 5. DESIGN PARTNER CRM (admin-only, internal)
-- ============================================================
create table if not exists public.design_partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  contact_name text,
  contact_email text,
  contact_role text,
  status text not null default 'active' check (status in ('active', 'paused', 'churned')),
  satisfaction_score integer check (satisfaction_score between 1 and 10),
  requested_features text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists design_partners_updated_at on public.design_partners;
create trigger design_partners_updated_at before update on public.design_partners
  for each row execute procedure public.set_updated_at();

alter table public.design_partners enable row level security;
create policy "design_partners_select" on public.design_partners for select using (public.is_admin());
create policy "design_partners_insert" on public.design_partners for insert with check (public.is_admin());
create policy "design_partners_update" on public.design_partners for update using (public.is_admin());
create policy "design_partners_delete" on public.design_partners for delete using (public.is_admin());

-- ============================================================
-- 6. PRODUCT ANALYTICS FUNNEL (exact stages requested this sprint)
-- ============================================================
create or replace function public.get_product_analytics_funnel()
returns table (
  signups bigint,
  onboarding_completion bigint,
  gmail_connections bigint,
  campaign_launches bigint,
  first_email_sent bigint,
  first_reply_received bigint,
  first_meeting_booked bigint
)
language plpgsql security definer stable as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      (select count(*) from public.profiles),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'workforce_deployed'),
      (select count(distinct organization_id) from public.organization_integrations where provider = 'gmail' and status = 'connected'),
      (select count(distinct organization_id) from public.organization_activity where activity_type = 'campaign_launched'),
      (select count(distinct organization_id) from public.sales_activities where activity_type = 'email_sent'),
      (select count(distinct organization_id) from public.sales_activities where activity_type = 'reply_received'),
      (select count(distinct organization_id) from public.sales_activities where activity_type = 'meeting_booked');
end;
$$;

-- ============================================================
-- 7. CAMPAIGN COMMAND CENTER: prospect pipeline + email queue
-- ============================================================
-- "Discovered" and "Enriched" both come from the same Research Prospect
-- step in this pipeline (a domain is looked up and enriched into real
-- people in one call) — Discovered counts the target domains searched,
-- Enriched counts the real people actually found, an honest distinction
-- even though they happen in the same execution.
create or replace function public.get_prospect_pipeline(p_org_id uuid)
returns table (discovered bigint, enriched bigint, contacted bigint, responded bigint, meeting_booked bigint)
language plpgsql security definer stable as $$
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select
      coalesce((select sum(jsonb_array_length(t.output -> 'domains_searched')) from public.tasks t where t.organization_id = p_org_id and t.output ? 'domains_searched'), 0),
      (select count(*) from public.sales_activities where organization_id = p_org_id and activity_type = 'lead_found'),
      (select count(*) from public.sales_activities where organization_id = p_org_id and activity_type = 'email_sent'),
      (select count(*) from public.sales_activities where organization_id = p_org_id and activity_type = 'reply_received'),
      (select count(*) from public.sales_activities where organization_id = p_org_id and activity_type = 'meeting_booked');
end;
$$;

create or replace function public.get_email_queue(p_org_id uuid)
returns table (pending_approval bigint, approved bigint, sent bigint, replied bigint)
language plpgsql security definer stable as $$
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select
      (select count(*) from public.tasks where organization_id = p_org_id and requires_approval and approved_at is null),
      (select count(*) from public.tasks where organization_id = p_org_id and requires_approval and approved_at is not null and not (output ? 'sent')),
      (select count(*) from public.sales_activities where organization_id = p_org_id and activity_type = 'email_sent'),
      (select count(*) from public.sales_activities where organization_id = p_org_id and activity_type = 'reply_received');
end;
$$;

-- Real, not estimated: agent_executions.cost is the actual per-execution
-- wallet debit already tracked since Phase 7 (agent_wallet_transaction).
-- Summing it, joined through tasks.organization_id, gives ROI a genuine
-- "what this campaign cost to run" figure instead of a fabricated one.
create or replace function public.get_campaign_cost(p_org_id uuid)
returns numeric
language plpgsql security definer stable as $$
declare
  v_cost numeric;
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select coalesce(sum(e.cost), 0) into v_cost
  from public.agent_executions e
  join public.tasks t on t.id = e.task_id
  where t.organization_id = p_org_id;

  return v_cost;
end;
$$;

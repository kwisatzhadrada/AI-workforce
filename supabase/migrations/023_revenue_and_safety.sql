-- ============================================================
-- Phase 24 — Revenue & Customer Acquisition Sprint
-- Three genuinely new, real capabilities this phase requires: a way to
-- actually charge money (Stripe-backed subscriptions), a way to stop a
-- design partner from accidentally blasting hundreds of emails through
-- their own real Gmail account (send caps + duplicate prevention), and a
-- way for a prospective design partner to apply before they have an
-- account at all. No new AI systems, no new agent architecture.
-- ============================================================

-- ============================================================
-- 0. SECURITY FIX: log_audit_event() had no authorization check
-- ============================================================
-- Found while wiring this phase's send-audit logging: log_audit_event()
-- (migration 021) is security definer with no internal auth check and no
-- REVOKE, meaning any authenticated user could already call it directly
-- (not just via `perform` from an already-authorized function) to insert
-- a fabricated audit_log row against ANY organization — undermining the
-- audit log's entire integrity. Fixed here, not worked around, since
-- this phase is the first time application code calls it directly rather
-- than only through another security-definer function's `perform`.
create or replace function public.log_audit_event(p_org_id uuid, p_action text, p_target_type text default null, p_target_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (p_org_id, auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

-- ============================================================
-- 1. BILLING: organization_subscriptions
-- ============================================================
-- One row per organization. Trial starts the moment an organization is
-- created (see the trigger below) — no card required — so a design
-- partner can fully evaluate the product before Stripe enters the
-- picture at all. `stripe_customer_id`/`stripe_subscription_id` stay
-- null until they actually start a paid subscription.
create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text check (plan in ('standard', 'growth')),
  status text not null default 'trialing' check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'
  )),
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_payment_failed_at timestamptz,
  -- A human (admin) override for design partners who aren't paying yet —
  -- deliberately separate from `status` so Stripe's own webhook-driven
  -- status updates can never silently clobber a comped arrangement.
  admin_comped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organization_subscriptions_updated_at on public.organization_subscriptions;
create trigger organization_subscriptions_updated_at before update on public.organization_subscriptions
  for each row execute procedure public.set_updated_at();

alter table public.organization_subscriptions enable row level security;
create policy "organization_subscriptions_select" on public.organization_subscriptions for select using (
  public.is_org_member(organization_id, auth.uid()) or public.is_admin()
);

-- A brand-new organization gets a real trial automatically — the same
-- moment `organizations_after_insert` (migration 005) logs the
-- `organization_created` activity event.
create or replace function public.start_trial_for_new_organization() returns trigger
language plpgsql security definer as $$
begin
  insert into public.organization_subscriptions (organization_id, status, trial_end)
  values (new.id, 'trialing', now() + interval '14 days')
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_after_insert_trial on public.organizations;
create trigger organizations_after_insert_trial
  after insert on public.organizations
  for each row execute procedure public.start_trial_for_new_organization();

-- Real subscription status, computed once and reused everywhere (the
-- billing UI, the send-eligibility check below) rather than each caller
-- re-deriving "is this org allowed to send" from raw columns.
create or replace function public.get_organization_billing_status(p_org_id uuid)
returns table (
  status text, plan text, trial_end timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean, admin_comped boolean, is_active boolean, days_left_in_trial int
)
language plpgsql security definer stable as $$
declare
  v_row public.organization_subscriptions;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  select * into v_row from public.organization_subscriptions where organization_id = p_org_id;
  if v_row is null then
    -- Pre-migration organizations (created before this phase) never got
    -- the insert trigger — treat them as if their trial just started
    -- rather than silently blocking every existing design partner.
    return query select 'trialing'::text, null::text, (now() + interval '14 days'), null::timestamptz, false, false, true, 14;
    return;
  end if;

  return query select
    v_row.status, v_row.plan, v_row.trial_end, v_row.current_period_end, v_row.cancel_at_period_end, v_row.admin_comped,
    (v_row.admin_comped or v_row.status in ('trialing', 'active') or (v_row.status = 'past_due' and v_row.current_period_end > now() - interval '3 days')),
    greatest(0, extract(day from (v_row.trial_end - now()))::int);
end;
$$;

-- Written only by the Stripe webhook handler (service_role) — the one
-- place Stripe's own event payload gets translated into our schema, so
-- there is exactly one function to check when debugging a billing
-- discrepancy, not application code scattered across every webhook event
-- type.
create or replace function public.upsert_subscription_from_stripe_system(
  p_org_id uuid, p_stripe_customer_id text, p_stripe_subscription_id text default null,
  p_plan text default null, p_status text default 'trialing',
  p_trial_end timestamptz default null, p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false
)
returns public.organization_subscriptions language plpgsql security definer as $$
declare
  v_row public.organization_subscriptions;
begin
  if not public.is_system_caller() then
    raise exception 'not authorized';
  end if;

  insert into public.organization_subscriptions (
    organization_id, stripe_customer_id, stripe_subscription_id, plan, status, trial_end, current_period_end, cancel_at_period_end
  )
  values (p_org_id, p_stripe_customer_id, p_stripe_subscription_id, p_plan, p_status, p_trial_end, p_current_period_end, p_cancel_at_period_end)
  on conflict (organization_id) do update set
    stripe_customer_id = coalesce(excluded.stripe_customer_id, public.organization_subscriptions.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.organization_subscriptions.stripe_subscription_id),
    plan = coalesce(excluded.plan, public.organization_subscriptions.plan),
    status = excluded.status,
    trial_end = coalesce(excluded.trial_end, public.organization_subscriptions.trial_end),
    current_period_end = coalesce(excluded.current_period_end, public.organization_subscriptions.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end
  returning * into v_row;

  return v_row;
end;
$$;
revoke execute on function public.upsert_subscription_from_stripe_system(uuid, text, text, text, text, timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.upsert_subscription_from_stripe_system(uuid, text, text, text, text, timestamptz, timestamptz, boolean) to service_role;

create or replace function public.record_payment_failure_system(p_org_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_system_caller() then
    raise exception 'not authorized';
  end if;

  update public.organization_subscriptions set last_payment_failed_at = now() where organization_id = p_org_id;
  perform public.log_audit_event(p_org_id, 'payment_failed', 'organization_subscriptions', p_org_id, '{}'::jsonb);
end;
$$;
revoke execute on function public.record_payment_failure_system(uuid) from public, anon, authenticated;
grant execute on function public.record_payment_failure_system(uuid) to service_role;

-- Admin-only comp toggle — the escape hatch for design partners who
-- aren't paying yet.
create or replace function public.set_subscription_comped(p_org_id uuid, p_comped boolean)
returns public.organization_subscriptions language plpgsql security definer as $$
declare
  v_row public.organization_subscriptions;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.organization_subscriptions set admin_comped = p_comped where organization_id = p_org_id returning * into v_row;
  perform public.log_audit_event(p_org_id, 'subscription_comped_changed', 'organization_subscriptions', p_org_id, jsonb_build_object('comped', p_comped));
  return v_row;
end;
$$;

-- ============================================================
-- 2. SAFETY CONTROLS: send caps + duplicate prevention
-- ============================================================
alter table public.organizations add column if not exists daily_send_cap int not null default 50;

-- Checked once, right before a batch of drafts is actually sent
-- (lib/runtime/campaignActions.ts) — combines the subscription gate and
-- the daily cap into one real answer, so the send code path has exactly
-- one place to ask "am I allowed to send these N emails right now."
create or replace function public.check_send_eligibility(p_org_id uuid, p_count int)
returns table (allowed boolean, reason text, sent_today int, daily_cap int)
language plpgsql security definer as $$
declare
  v_billing record;
  v_sent_today int;
  v_cap int;
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select * into v_billing from public.get_organization_billing_status(p_org_id);
  select daily_send_cap into v_cap from public.organizations where id = p_org_id;
  select count(*) into v_sent_today from public.sales_activities
    where organization_id = p_org_id and activity_type = 'email_sent' and created_at >= date_trunc('day', now());

  if not v_billing.is_active then
    return query select false, 'subscription_inactive', v_sent_today, v_cap;
    return;
  end if;

  if v_sent_today + p_count > v_cap then
    return query select false, 'daily_cap_exceeded', v_sent_today, v_cap;
    return;
  end if;

  return query select true, null::text, v_sent_today, v_cap;
end;
$$;

create or replace function public.set_daily_send_cap(p_org_id uuid, p_cap int)
returns public.organizations language plpgsql security definer as $$
declare
  v_row public.organizations;
begin
  if not (public.is_org_manager(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;
  if p_cap < 1 or p_cap > 1000 then
    raise exception 'daily send cap must be between 1 and 1000';
  end if;

  update public.organizations set daily_send_cap = p_cap where id = p_org_id returning * into v_row;
  perform public.log_audit_event(p_org_id, 'daily_send_cap_changed', 'organizations', p_org_id, jsonb_build_object('cap', p_cap));
  return v_row;
end;
$$;

-- Real, org-scoped duplicate-contact check — "has this exact email
-- address already been sent a real outreach email by this org, ever,"
-- so the same person is never contacted twice across two different
-- campaign runs (a single task's own drafts were already deduplicated
-- by the existing `output.sent` check in sendApprovedOutreach()).
create or replace function public.get_already_contacted(p_org_id uuid, p_emails text[])
returns table (contact_email text)
language plpgsql security definer stable as $$
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select distinct s.contact_email from public.sales_activities s
    where s.organization_id = p_org_id and s.activity_type = 'email_sent' and s.contact_email = any(p_emails);
end;
$$;

-- ============================================================
-- 3. DESIGN PARTNER APPLICATIONS
-- ============================================================
-- Public-facing (no account required) — a prospective design partner
-- applies before they ever sign up. Distinct from `design_partners`
-- (Phase 17's admin-only internal CRM for partners already onboarded);
-- this is the intake form that happens before that.
create table if not exists public.design_partner_applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  industry text not null,
  team_size text not null,
  current_sales_process text not null,
  goals text not null,
  contact_name text not null,
  contact_email text not null,
  contact_role text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);
create index if not exists design_partner_applications_status_idx on public.design_partner_applications (status, created_at desc);

alter table public.design_partner_applications enable row level security;

-- Admin-only select — an applicant has no account yet to check
-- ownership against, so there is no "select your own application" case
-- to support (the form itself doesn't read anything back).
create policy "design_partner_applications_select" on public.design_partner_applications for select using (public.is_admin());

-- Anyone (including a fully logged-out visitor) can submit an
-- application — this is the one legitimate `anon`-reachable insert in
-- the whole schema, gated only by input validation inside the function,
-- not by auth, since applying doesn't require an account.
create or replace function public.submit_design_partner_application(
  p_company_name text, p_industry text, p_team_size text, p_current_sales_process text,
  p_goals text, p_contact_name text, p_contact_email text, p_contact_role text default null
)
returns public.design_partner_applications language plpgsql security definer as $$
declare
  v_row public.design_partner_applications;
begin
  if length(trim(p_company_name)) = 0 or length(trim(p_contact_name)) = 0 or length(trim(p_contact_email)) = 0 then
    raise exception 'company name, contact name, and contact email are required';
  end if;
  if p_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid contact email';
  end if;

  insert into public.design_partner_applications (
    company_name, industry, team_size, current_sales_process, goals, contact_name, contact_email, contact_role
  )
  values (
    trim(p_company_name), trim(p_industry), trim(p_team_size), trim(p_current_sales_process),
    trim(p_goals), trim(p_contact_name), lower(trim(p_contact_email)), nullif(trim(coalesce(p_contact_role, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;
grant execute on function public.submit_design_partner_application(text, text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.review_design_partner_application(p_application_id uuid, p_status text, p_notes text default null)
returns public.design_partner_applications language plpgsql security definer as $$
declare
  v_row public.design_partner_applications;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.design_partner_applications set
    status = p_status, review_notes = p_notes, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_application_id
  returning * into v_row;

  return v_row;
end;
$$;

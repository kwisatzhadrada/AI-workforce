-- ============================================================
-- Phase 20 — The AI Operating Executive
-- Constraint carried through every section: no new templates, no new
-- workflow types, no new agent types, no new admin dashboards. Every
-- new table below represents a genuinely new CONCEPT this platform
-- didn't have a place for yet (a business-level memory ledger, an A/B
-- test, a narrative brief, an autonomy setting) — the "intelligence" on
-- top of it is read-only aggregation and a few fixed, documented rules
-- over data that already exists, not a new execution architecture. The
-- Executive Agent is not a new row in `agents` (that would be "a new
-- agent type"); it's a per-organization control-plane record plus a set
-- of RPCs that reason over existing goals/tasks/sales_activities and, at
-- higher autonomy levels, call the same existing execution/approval
-- paths a human would otherwise click through one at a time.
-- ============================================================

-- ============================================================
-- 1. EXECUTIVE AGENT (autonomy configuration, one per organization)
-- ============================================================
-- Level 0: human controls everything. Level 1: AI recommends only.
-- Level 2: AI drafts, waits for approval (the platform's real default
-- behavior since the human-approval-gate columns were added — outreach
-- has never auto-sent). Level 3: AI chains already-approved stages
-- together in one action instead of requiring a click per stage. Level
-- 4: AI auto-applies a concluded experiment's winning variant instead of
-- waiting for a human to apply it. There is still no background worker
-- anywhere in this platform — every one of these is still triggered by a
-- human loading a page or clicking a button; higher levels just do more
-- per click and require fewer separate approvals, not less oversight.
create table if not exists public.organization_executive (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  autonomy_level int not null default 2 check (autonomy_level between 0 and 4),
  -- The one persistent "self-optimization" lever: once a subject-line
  -- test concludes with a real winner, this is what future drafts use
  -- instead of the platform's original hardcoded default — set
  -- automatically at autonomy level 4, or by a manager's explicit
  -- "Apply Winner" click at any lower level.
  default_subject_line text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organization_executive_updated_at on public.organization_executive;
create trigger organization_executive_updated_at before update on public.organization_executive
  for each row execute procedure public.set_updated_at();

alter table public.organization_executive enable row level security;
create policy "organization_executive_select" on public.organization_executive for select using (public.is_org_member(organization_id, auth.uid()));

-- Every existing organization gets a row backfilled at the platform's
-- real current default behavior (level 2); every new one gets it the
-- moment it's created, the same "trigger owns the invariant" pattern
-- organizations_after_insert_activity already established.
insert into public.organization_executive (organization_id, autonomy_level)
select id, 2 from public.organizations
on conflict (organization_id) do nothing;

create or replace function public.trg_organizations_after_insert_executive()
returns trigger language plpgsql security definer as $$
begin
  insert into public.organization_executive (organization_id, autonomy_level) values (new.id, 2)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;
drop trigger if exists organizations_after_insert_executive on public.organizations;
create trigger organizations_after_insert_executive after insert on public.organizations
  for each row execute procedure public.trg_organizations_after_insert_executive();

create or replace function public.set_autonomy_level(p_org_id uuid, p_level int)
returns public.organization_executive language plpgsql security definer as $$
declare
  v_row public.organization_executive;
begin
  if not public.is_org_manager(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_level < 0 or p_level > 4 then
    raise exception 'autonomy level must be between 0 and 4';
  end if;

  insert into public.organization_executive (organization_id, autonomy_level)
  values (p_org_id, p_level)
  on conflict (organization_id) do update set autonomy_level = p_level
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- 2. ORGANIZATIONAL MEMORY
-- ============================================================
-- Memory was agent-level only (agent_memory, Phase 6). This is the first
-- business-level memory: what ICP was tried, over what real time window,
-- and what it actually produced. Write-only via the RPC below (no direct
-- insert policy), same pattern meetings/organization_reports established.
create table if not exists public.organization_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  memory_type text not null check (memory_type in ('icp_result', 'lesson_learned')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists organization_memory_org_id_idx on public.organization_memory (organization_id, created_at desc);

alter table public.organization_memory enable row level security;
create policy "organization_memory_select" on public.organization_memory for select using (public.is_org_member(organization_id, auth.uid()));

create or replace function public.record_organization_memory(p_org_id uuid, p_memory_type text, p_content jsonb)
returns public.organization_memory language plpgsql security definer as $$
declare
  v_row public.organization_memory;
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_memory_type not in ('icp_result', 'lesson_learned') then
    raise exception 'invalid memory_type %', p_memory_type;
  end if;

  insert into public.organization_memory (organization_id, memory_type, content)
  values (p_org_id, p_memory_type, p_content)
  returning * into v_row;

  return v_row;
end;
$$;

-- Relaunching a campaign with a new ICP used to silently overwrite the
-- old one in organization_goals.target_metrics — the exact "no memory"
-- gap this phase is about. This RPC snapshots the OLD ICP plus its real,
-- time-windowed outcomes (from the moment it was set to now) into
-- organization_memory before writing the new one. The window's start is
-- read back from the ICP's own 'setAt' timestamp (written by this same
-- function every time), not guessed — an honest, if org-wide rather than
-- per-goal, proxy, since this platform runs exactly one active "Generate
-- Leads" campaign per organization at a time.
create or replace function public.launch_campaign_icp(
  p_goal_id uuid, p_target_industry text, p_company_size text, p_location text, p_icp_description text
)
returns public.organization_goals language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_old_icp jsonb;
  v_old_set_at timestamptz;
  v_metrics record;
  v_row public.organization_goals;
begin
  select organization_id, target_metrics->'icp' into v_org_id, v_old_icp from public.organization_goals where id = p_goal_id;
  if v_org_id is null then
    raise exception 'goal not found';
  end if;
  if not public.is_org_member(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  if v_old_icp is not null and v_old_icp ? 'setAt' then
    v_old_set_at := (v_old_icp->>'setAt')::timestamptz;

    select
      count(*) filter (where activity_type = 'lead_found') as leads_found,
      count(*) filter (where activity_type = 'email_sent') as emails_sent,
      count(*) filter (where activity_type = 'reply_received') as replies_received,
      count(*) filter (where activity_type = 'meeting_booked') as meetings_booked
    into v_metrics
    from public.sales_activities
    where organization_id = v_org_id and created_at >= v_old_set_at;

    -- Only worth remembering if real outreach actually happened under it —
    -- otherwise it's noise, not a lesson.
    if coalesce(v_metrics.emails_sent, 0) > 0 then
      insert into public.organization_memory (organization_id, memory_type, content)
      values (v_org_id, 'icp_result', jsonb_build_object(
        'icp', v_old_icp,
        'period_start', v_old_set_at,
        'period_end', now(),
        'leads_found', coalesce(v_metrics.leads_found, 0),
        'emails_sent', coalesce(v_metrics.emails_sent, 0),
        'replies_received', coalesce(v_metrics.replies_received, 0),
        'meetings_booked', coalesce(v_metrics.meetings_booked, 0),
        'reply_rate', round(coalesce(v_metrics.replies_received, 0)::numeric / nullif(v_metrics.emails_sent, 0) * 100, 1)
      ));
    end if;
  end if;

  update public.organization_goals set target_metrics = jsonb_build_object(
    'icp', jsonb_build_object(
      'targetIndustry', p_target_industry, 'companySize', p_company_size,
      'location', p_location, 'icpDescription', p_icp_description,
      'setAt', now()
    )
  ) where id = p_goal_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- 3. LEARNING SYSTEM
-- ============================================================
create or replace function public.generate_lessons_learned(p_org_id uuid)
returns jsonb
language plpgsql security definer stable as $$
declare
  v_lessons jsonb := '[]'::jsonb;
  v_best_industry text; v_best_industry_rate numeric;
  v_worst_industry text; v_worst_industry_rate numeric;
  v_best_size text; v_best_size_meetings int;
  v_variant_a jsonb; v_variant_b jsonb; v_winner text;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  with by_industry as (
    select
      content->'icp'->>'targetIndustry' as industry,
      sum((content->>'emails_sent')::int) as emails_sent,
      sum((content->>'replies_received')::int) as replies_received
    from public.organization_memory
    where organization_id = p_org_id and memory_type = 'icp_result'
      and coalesce(content->'icp'->>'targetIndustry', '') <> ''
    group by content->'icp'->>'targetIndustry'
    having sum((content->>'emails_sent')::int) >= 3
  ),
  ranked as (
    select industry, round(replies_received::numeric / nullif(emails_sent, 0) * 100, 1) as reply_rate
    from by_industry
  )
  select
    (array_agg(industry order by reply_rate desc nulls last))[1],
    (array_agg(reply_rate order by reply_rate desc nulls last))[1],
    (array_agg(industry order by reply_rate asc nulls last))[1],
    (array_agg(reply_rate order by reply_rate asc nulls last))[1]
  into v_best_industry, v_best_industry_rate, v_worst_industry, v_worst_industry_rate
  from ranked;

  if v_best_industry is not null and v_worst_industry is not null and v_best_industry <> v_worst_industry then
    if v_worst_industry_rate > 0 then
      v_lessons := v_lessons || jsonb_build_array(format(
        '%s companies responded %sx more than %s companies (%s%% vs %s%% reply rate).',
        v_best_industry, round(v_best_industry_rate / nullif(v_worst_industry_rate, 0), 1), v_worst_industry, v_best_industry_rate, v_worst_industry_rate
      ));
    elsif v_best_industry_rate > 0 then
      v_lessons := v_lessons || jsonb_build_array(format(
        '%s companies responded (%s%% reply rate) while %s companies had no replies at all.',
        v_best_industry, v_best_industry_rate, v_worst_industry
      ));
    end if;
  end if;

  with by_size as (
    select
      content->'icp'->>'companySize' as company_size,
      sum((content->>'meetings_booked')::int) as meetings_booked,
      sum((content->>'emails_sent')::int) as emails_sent
    from public.organization_memory
    where organization_id = p_org_id and memory_type = 'icp_result'
      and coalesce(content->'icp'->>'companySize', '') <> ''
    group by content->'icp'->>'companySize'
    having sum((content->>'emails_sent')::int) >= 3
  )
  select company_size, meetings_booked into v_best_size, v_best_size_meetings from by_size order by meetings_booked desc limit 1;

  if v_best_size is not null and v_best_size_meetings > 0 then
    v_lessons := v_lessons || jsonb_build_array(format('Companies sized %s converted best (%s meeting(s) booked).', v_best_size, v_best_size_meetings));
  end if;

  select variant_a, variant_b, winner into v_variant_a, v_variant_b, v_winner
  from public.experiments
  where organization_id = p_org_id and status = 'concluded' and winner in ('a', 'b')
  order by concluded_at desc limit 1;

  if v_winner = 'a' then
    v_lessons := v_lessons || jsonb_build_array(format(
      'Subject line "%s" outperformed "%s" (%s%% vs %s%% reply rate).',
      v_variant_a->>'subject_line', v_variant_b->>'subject_line', v_variant_a->>'reply_rate', v_variant_b->>'reply_rate'
    ));
  elsif v_winner = 'b' then
    v_lessons := v_lessons || jsonb_build_array(format(
      'Subject line "%s" outperformed "%s" (%s%% vs %s%% reply rate).',
      v_variant_b->>'subject_line', v_variant_a->>'subject_line', v_variant_b->>'reply_rate', v_variant_a->>'reply_rate'
    ));
  end if;

  return v_lessons;
end;
$$;

-- ============================================================
-- 4. STRATEGIC RECOMMENDATION ENGINE
-- ============================================================
create or replace function public.get_strategic_recommendations(p_org_id uuid)
returns jsonb
language plpgsql security definer stable as $$
declare
  v_recs jsonb := '[]'::jsonb;
  v_metrics record;
  v_hubspot_connected boolean;
  v_pending_approval int;
  v_running_experiment boolean;
  v_lessons jsonb;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  select * into v_metrics from public.get_sales_metrics(p_org_id);
  select exists (select 1 from public.organization_integrations where organization_id = p_org_id and provider = 'hubspot' and status = 'connected') into v_hubspot_connected;
  select count(*) into v_pending_approval from public.tasks where organization_id = p_org_id and requires_approval and approved_at is null;
  select exists (select 1 from public.experiments where organization_id = p_org_id and status = 'running') into v_running_experiment;
  v_lessons := public.generate_lessons_learned(p_org_id);

  if not v_hubspot_connected then
    v_recs := v_recs || jsonb_build_array('Connect HubSpot to keep your CRM automatically up to date.');
  end if;
  if v_pending_approval > 0 then
    v_recs := v_recs || jsonb_build_array(format('%s draft email(s) are waiting for your approval.', v_pending_approval));
  end if;
  if coalesce(v_metrics.emails_sent, 0) > 0 and coalesce(v_metrics.reply_rate, 0) < 5 then
    v_recs := v_recs || jsonb_build_array('Reply rate is under 5% — expand or refine your ICP targeting.');
  end if;
  if coalesce(v_metrics.emails_sent, 0) > 0 and coalesce(v_metrics.reply_rate, 0) >= 15 then
    v_recs := v_recs || jsonb_build_array('Reply rate is strong — consider increasing daily send volume.');
  end if;
  if not v_running_experiment and coalesce(v_metrics.emails_sent, 0) >= 10 then
    v_recs := v_recs || jsonb_build_array('You have enough send volume to start a subject-line A/B test.');
  end if;
  if jsonb_array_length(v_lessons) > 0 then
    v_recs := v_recs || v_lessons;
  end if;
  if jsonb_array_length(v_recs) = 0 then
    v_recs := v_recs || jsonb_build_array('Everything looks healthy — no action needed right now.');
  end if;

  return v_recs;
end;
$$;

-- ============================================================
-- 5. EXECUTIVE BRIEFINGS
-- ============================================================
create table if not exists public.executive_briefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_type text not null check (period_type in ('daily', 'weekly', 'monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  content jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists executive_briefs_org_id_idx on public.executive_briefs (organization_id, created_at desc);

alter table public.executive_briefs enable row level security;
create policy "executive_briefs_select" on public.executive_briefs for select using (public.is_org_member(organization_id, auth.uid()));

create or replace function public.generate_executive_brief(p_org_id uuid, p_period_type text)
returns public.executive_briefs language plpgsql security definer as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz := now();
  v_metrics record;
  v_meetings_count int;
  v_outcomes record;
  v_what_happened jsonb;
  v_what_worked jsonb := '[]'::jsonb;
  v_what_failed jsonb := '[]'::jsonb;
  v_needs_attention jsonb := '[]'::jsonb;
  v_recommended jsonb;
  v_pending_approval int;
  v_row public.executive_briefs;
begin
  if not public.is_org_member(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_period_type not in ('daily', 'weekly', 'monthly') then
    raise exception 'invalid period_type %', p_period_type;
  end if;

  v_period_start := case p_period_type
    when 'daily' then v_period_end - interval '1 day'
    when 'weekly' then v_period_end - interval '7 days'
    else v_period_end - interval '30 days'
  end;

  select
    count(*) filter (where activity_type = 'lead_found') as leads_found,
    count(*) filter (where activity_type = 'email_sent') as emails_sent,
    count(*) filter (where activity_type = 'reply_received') as replies_received
  into v_metrics
  from public.sales_activities
  where organization_id = p_org_id and created_at between v_period_start and v_period_end;

  select count(*) into v_meetings_count from public.meetings where organization_id = p_org_id and created_at between v_period_start and v_period_end;
  select * into v_outcomes from public.get_business_outcomes(p_org_id);
  select count(*) into v_pending_approval from public.tasks where organization_id = p_org_id and requires_approval and approved_at is null;

  v_what_happened := jsonb_build_array(
    format('%s companies targeted', coalesce(v_metrics.leads_found, 0)),
    format('%s replies received', coalesce(v_metrics.replies_received, 0)),
    format('%s meeting(s) booked', coalesce(v_meetings_count, 0)),
    format('%s pipeline created', coalesce(v_outcomes.pipeline_generated, 0))
  );

  if coalesce(v_metrics.replies_received, 0) > 0 then
    v_what_worked := v_what_worked || jsonb_build_array(format('%s prospect(s) replied to outreach this period.', v_metrics.replies_received));
  end if;
  if coalesce(v_meetings_count, 0) > 0 then
    v_what_worked := v_what_worked || jsonb_build_array(format('%s meeting(s) booked this period.', v_meetings_count));
  end if;

  if coalesce(v_metrics.emails_sent, 0) > 0 and coalesce(v_metrics.replies_received, 0) = 0 then
    v_what_failed := v_what_failed || jsonb_build_array('No replies yet this period despite sending outreach.');
  end if;
  if coalesce(v_metrics.leads_found, 0) = 0 then
    v_what_failed := v_what_failed || jsonb_build_array('No new prospects were found this period.');
  end if;

  if v_pending_approval > 0 then
    v_needs_attention := v_needs_attention || jsonb_build_array(format('%s draft email(s) waiting for your approval.', v_pending_approval));
  end if;

  v_recommended := public.get_strategic_recommendations(p_org_id);

  insert into public.executive_briefs (organization_id, period_type, period_start, period_end, generated_by, content)
  values (
    p_org_id, p_period_type, v_period_start, v_period_end, auth.uid(),
    jsonb_build_object(
      'what_happened', v_what_happened,
      'what_worked', v_what_worked,
      'what_failed', v_what_failed,
      'needs_attention', v_needs_attention,
      'recommended_actions', v_recommended
    )
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- 6. EXPERIMENT FRAMEWORK (subject-line A/B tests)
-- ============================================================
-- Scoped to exactly the one experiment type actually wired into a real
-- execution path (assignment happens in runEmailOutreachDraft). ICP and
-- follow-up-timing experiments aren't exposed anywhere in the UI yet —
-- better to ship one real, fully-wired experiment type than a picker
-- that quietly does nothing for two of its three options.
create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  goal_id uuid references public.organization_goals(id) on delete set null,
  experiment_type text not null default 'subject_line' check (experiment_type in ('subject_line')),
  variant_a jsonb not null,
  variant_b jsonb not null,
  status text not null default 'running' check (status in ('running', 'concluded')),
  winner text check (winner in ('a', 'b', 'tie')),
  started_at timestamptz not null default now(),
  concluded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
);
create index if not exists experiments_org_id_idx on public.experiments (organization_id, started_at desc);

alter table public.experiments enable row level security;
create policy "experiments_select" on public.experiments for select using (public.is_org_member(organization_id, auth.uid()));

create table if not exists public.experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  contact_email text not null,
  variant text not null check (variant in ('a', 'b')),
  created_at timestamptz not null default now(),
  unique (experiment_id, contact_email)
);

alter table public.experiment_assignments enable row level security;
create policy "experiment_assignments_select" on public.experiment_assignments for select using (
  exists (select 1 from public.experiments e where e.id = experiment_id and public.is_org_member(e.organization_id, auth.uid()))
);

-- Starting a test is a strategic call (like setting avg deal value or
-- the autonomy level) — manager-gated, not any org member.
create or replace function public.create_experiment(p_org_id uuid, p_goal_id uuid, p_subject_a text, p_subject_b text)
returns public.experiments language plpgsql security definer as $$
declare
  v_row public.experiments;
begin
  if not public.is_org_manager(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  insert into public.experiments (organization_id, goal_id, variant_a, variant_b, created_by)
  values (p_org_id, p_goal_id, jsonb_build_object('subject_line', p_subject_a), jsonb_build_object('subject_line', p_subject_b), auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- Deterministic, race-safe assignment: which variant a contact gets is a
-- pure function of their email, not a mutable counter, so drafting the
-- same lead twice (a retry, a rerun) can't accidentally reassign them.
create or replace function public.assign_experiment_variant(p_experiment_id uuid, p_contact_email text)
returns text language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_status text;
  v_variant text;
begin
  select organization_id, status into v_org_id, v_status from public.experiments where id = p_experiment_id;
  if v_org_id is null then
    raise exception 'experiment not found';
  end if;
  if not public.is_org_member(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if v_status <> 'running' then
    raise exception 'experiment is not running';
  end if;

  v_variant := case when ('x' || md5(lower(p_contact_email)))::bit(32)::int % 2 = 0 then 'a' else 'b' end;

  insert into public.experiment_assignments (experiment_id, contact_email, variant)
  values (p_experiment_id, lower(p_contact_email), v_variant)
  on conflict (experiment_id, contact_email) do nothing;

  select variant into v_variant from public.experiment_assignments where experiment_id = p_experiment_id and contact_email = lower(p_contact_email);
  return v_variant;
end;
$$;

create or replace function public.conclude_experiment(p_experiment_id uuid)
returns public.experiments language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_variant_a jsonb;
  v_variant_b jsonb;
  v_a_sent int; v_a_replies int; v_b_sent int; v_b_replies int;
  v_a_rate numeric; v_b_rate numeric;
  v_winner text;
  v_row public.experiments;
begin
  select organization_id, variant_a, variant_b into v_org_id, v_variant_a, v_variant_b from public.experiments where id = p_experiment_id;
  if v_org_id is null then
    raise exception 'experiment not found';
  end if;
  if not public.is_org_manager(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select count(*) into v_a_sent from public.experiment_assignments ea
    join public.sales_activities s on s.contact_email = ea.contact_email and s.organization_id = v_org_id and s.activity_type = 'email_sent'
    where ea.experiment_id = p_experiment_id and ea.variant = 'a';
  select count(*) into v_a_replies from public.experiment_assignments ea
    join public.sales_activities s on s.contact_email = ea.contact_email and s.organization_id = v_org_id and s.activity_type = 'reply_received'
    where ea.experiment_id = p_experiment_id and ea.variant = 'a';
  select count(*) into v_b_sent from public.experiment_assignments ea
    join public.sales_activities s on s.contact_email = ea.contact_email and s.organization_id = v_org_id and s.activity_type = 'email_sent'
    where ea.experiment_id = p_experiment_id and ea.variant = 'b';
  select count(*) into v_b_replies from public.experiment_assignments ea
    join public.sales_activities s on s.contact_email = ea.contact_email and s.organization_id = v_org_id and s.activity_type = 'reply_received'
    where ea.experiment_id = p_experiment_id and ea.variant = 'b';

  v_a_rate := case when v_a_sent > 0 then round(v_a_replies::numeric / v_a_sent * 100, 1) else 0 end;
  v_b_rate := case when v_b_sent > 0 then round(v_b_replies::numeric / v_b_sent * 100, 1) else 0 end;

  v_winner := case
    when v_a_sent = 0 and v_b_sent = 0 then null
    when v_a_rate > v_b_rate then 'a'
    when v_b_rate > v_a_rate then 'b'
    else 'tie'
  end;

  update public.experiments set
    status = 'concluded',
    concluded_at = now(),
    winner = v_winner,
    variant_a = v_variant_a || jsonb_build_object('sent', v_a_sent, 'replies', v_a_replies, 'reply_rate', v_a_rate),
    variant_b = v_variant_b || jsonb_build_object('sent', v_b_sent, 'replies', v_b_replies, 'reply_rate', v_b_rate)
  where id = p_experiment_id
  returning * into v_row;

  -- Level 4 ("AI self-optimizes campaigns") is the one place autonomy
  -- level changes what happens without a further click: a real winner
  -- becomes every future draft's subject line immediately. Below level 4,
  -- a manager applies it explicitly via apply_experiment_winner().
  if v_winner in ('a', 'b') and (select autonomy_level from public.organization_executive where organization_id = v_org_id) = 4 then
    update public.organization_executive
    set default_subject_line = (case when v_winner = 'a' then v_row.variant_a else v_row.variant_b end)->>'subject_line'
    where organization_id = v_org_id;
  end if;

  return v_row;
end;
$$;

create or replace function public.apply_experiment_winner(p_experiment_id uuid)
returns public.organization_executive language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_winner text;
  v_variant_a jsonb;
  v_variant_b jsonb;
  v_row public.organization_executive;
begin
  select organization_id, winner, variant_a, variant_b into v_org_id, v_winner, v_variant_a, v_variant_b
  from public.experiments where id = p_experiment_id;
  if v_org_id is null then
    raise exception 'experiment not found';
  end if;
  if not public.is_org_manager(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if v_winner not in ('a', 'b') then
    raise exception 'this experiment has no clear winner to apply';
  end if;

  update public.organization_executive
  set default_subject_line = (case when v_winner = 'a' then v_variant_a else v_variant_b end)->>'subject_line'
  where organization_id = v_org_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- 7. KNOWLEDGE GRAPH
-- ============================================================
-- Not a new graph database — a real projection over the foreign-key
-- relationships that already exist (organizations -> goals -> plans ->
-- steps -> tasks -> agents, sales_activities -> agents, meetings),
-- assembled into one payload so the Executive Agent (and the Command
-- Center UI) can reason across the business without N separate queries.
create or replace function public.get_organization_knowledge_graph(p_org_id uuid)
returns jsonb language plpgsql security definer stable as $$
declare
  v_nodes jsonb;
  v_edges jsonb;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'goals', (select count(*) from public.organization_goals where organization_id = p_org_id),
    'agents', (select count(*) from public.agent_assignments where organization_id = p_org_id and status = 'active'),
    'tasks', (select count(*) from public.tasks where organization_id = p_org_id),
    'meetings', (select count(*) from public.meetings where organization_id = p_org_id),
    'experiments', (select count(*) from public.experiments where organization_id = p_org_id)
  ) into v_nodes;

  select jsonb_build_object(
    'goal_to_agent', (
      select coalesce(jsonb_agg(distinct jsonb_build_object('goal', g.title, 'agent', a.name)), '[]'::jsonb)
      from public.organization_goals g
      join public.goal_plans gp on gp.goal_id = g.id
      join public.goal_plan_steps gps on gps.plan_id = gp.id
      join public.tasks t on t.id = gps.task_id
      join public.agents a on a.id = t.assigned_agent_id
      where g.organization_id = p_org_id
    ),
    'agent_to_outcome', (
      select coalesce(jsonb_agg(distinct jsonb_build_object('agent', a.name, 'outcome', s.activity_type)), '[]'::jsonb)
      from public.sales_activities s
      join public.agents a on a.id = s.agent_id
      where s.organization_id = p_org_id
    )
  ) into v_edges;

  return jsonb_build_object('nodes', v_nodes, 'edges', v_edges);
end;
$$;

-- ============================================================
-- 8. PERFORMANCE INTELLIGENCE (real outcomes only, per organization)
-- ============================================================
-- "Best campaign" and "best workflow" both collapse into "best ICP
-- period" honestly — a campaign IS an ICP-targeted run of the one B2B
-- Sales workflow this platform has, not a separate trackable entity.
create or replace function public.get_performance_intelligence(p_org_id uuid)
returns jsonb language plpgsql security definer stable as $$
declare
  v_best_icp jsonb;
  v_best_message jsonb;
  v_best_agent jsonb;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object('icp', content->'icp', 'reply_rate', content->'reply_rate', 'meetings_booked', content->'meetings_booked')
  into v_best_icp
  from public.organization_memory
  where organization_id = p_org_id and memory_type = 'icp_result' and (content->>'emails_sent')::int >= 3
  order by (content->>'reply_rate')::numeric desc nulls last
  limit 1;

  select jsonb_build_object('subject_line', (case when winner = 'a' then variant_a else variant_b end)->>'subject_line', 'reply_rate', (case when winner = 'a' then variant_a else variant_b end)->>'reply_rate')
  into v_best_message
  from public.experiments
  where organization_id = p_org_id and status = 'concluded' and winner in ('a', 'b')
  order by concluded_at desc
  limit 1;

  select jsonb_build_object(
    'agent_name', x.agent_name,
    'meetings_booked', x.meetings_booked,
    'emails_sent', x.emails_sent
  ) into v_best_agent
  from (
    select a.name as agent_name,
      count(*) filter (where s.activity_type = 'meeting_booked') as meetings_booked,
      count(*) filter (where s.activity_type = 'email_sent') as emails_sent
    from public.sales_activities s
    join public.agents a on a.id = s.agent_id
    where s.organization_id = p_org_id
    group by a.name
    order by count(*) filter (where s.activity_type = 'meeting_booked') desc, count(*) filter (where s.activity_type = 'email_sent') desc
    limit 1
  ) x;

  return jsonb_build_object('best_icp', v_best_icp, 'best_message', v_best_message, 'best_agent', v_best_agent);
end;
$$;

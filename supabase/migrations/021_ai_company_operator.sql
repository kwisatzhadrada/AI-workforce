-- ============================================================
-- Phase 21 — From AI Workforce Platform to AI Company Operator
-- The one genuine architectural evolution this phase requires: real
-- background execution needs a trusted execution context with no user
-- session, which this platform has never had (every prior phase's "no
-- background worker" was really "no autonomous execution," because
-- every RPC assumed a real authenticated org member). is_system_caller()
-- below checks auth.role() = 'service_role' — Supabase's own documented
-- mechanism for exactly this — and is added as an explicit OR-bypass to
-- a small, named allowlist of existing checks the cron worker actually
-- needs. The service-role key itself is never used anywhere a browser
-- can reach; only inside app/api/cron/process-jobs, gated first by a
-- CRON_SECRET bearer check before any DB access happens at all.
-- ============================================================

create or replace function public.is_system_caller() returns boolean
language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

-- ============================================================
-- 1. JOB QUEUE (production-grade execution layer)
-- ============================================================
create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  job_type text not null check (job_type in (
    'check_replies', 'sync_crm', 'generate_brief', 'evaluate_experiment',
    'health_check', 'progress_campaign', 'compute_daily_rollup'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'retrying', 'cancelled')),
  priority int not null default 5,
  attempts int not null default 0,
  scheduled_for timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists job_queue_claim_idx on public.job_queue (status, scheduled_for);
create index if not exists job_queue_org_idx on public.job_queue (organization_id, created_at desc);

drop trigger if exists job_queue_updated_at on public.job_queue;
create trigger job_queue_updated_at before update on public.job_queue
  for each row execute procedure public.set_updated_at();

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_queue(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  output jsonb,
  error text
);
create index if not exists job_runs_job_idx on public.job_runs (job_id, started_at desc);

create table if not exists public.job_failures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_queue(id) on delete cascade,
  run_id uuid references public.job_runs(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  job_type text not null,
  error_message text not null,
  will_retry boolean not null default false,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists job_failures_org_idx on public.job_failures (organization_id, created_at desc);

-- A policy, not a per-job setting — how many times, and how long to wait,
-- is a property of the job TYPE (a flaky Gmail call retries differently
-- than a brief generation), not something each individual job tunes.
create table if not exists public.retry_schedule (
  job_type text primary key,
  max_attempts int not null default 3,
  backoff_seconds int not null default 300
);
insert into public.retry_schedule (job_type, max_attempts, backoff_seconds) values
  ('check_replies', 3, 600),
  ('sync_crm', 3, 600),
  ('generate_brief', 2, 1800),
  ('evaluate_experiment', 2, 1800),
  ('health_check', 2, 1800),
  ('progress_campaign', 3, 900),
  ('compute_daily_rollup', 2, 1800)
on conflict (job_type) do nothing;

alter table public.job_queue enable row level security;
alter table public.job_runs enable row level security;
alter table public.job_failures enable row level security;
alter table public.retry_schedule enable row level security;

create policy "job_queue_select" on public.job_queue for select using (
  public.is_admin() or (organization_id is not null and public.is_org_member(organization_id, auth.uid()))
);
create policy "job_runs_select" on public.job_runs for select using (
  exists (select 1 from public.job_queue j where j.id = job_id and (public.is_admin() or (j.organization_id is not null and public.is_org_member(j.organization_id, auth.uid()))))
);
create policy "job_failures_select" on public.job_failures for select using (
  public.is_admin() or (organization_id is not null and public.is_org_member(organization_id, auth.uid()))
);
create policy "retry_schedule_select" on public.retry_schedule for select using (true);

-- User-facing: any org member can enqueue a job for their own org (e.g.
-- launching a campaign at autonomy level 3+ enqueues its own progression).
create or replace function public.enqueue_job(p_org_id uuid, p_job_type text, p_payload jsonb default '{}'::jsonb, p_scheduled_for timestamptz default now())
returns public.job_queue language plpgsql security definer as $$
declare
  v_row public.job_queue;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;
  if p_job_type not in ('check_replies', 'sync_crm', 'generate_brief', 'evaluate_experiment', 'health_check', 'progress_campaign', 'compute_daily_rollup') then
    raise exception 'invalid job_type %', p_job_type;
  end if;

  insert into public.job_queue (organization_id, job_type, payload, scheduled_for, created_by)
  values (p_org_id, p_job_type, p_payload, p_scheduled_for, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- Everything below this line is reachable only by the cron worker
-- (service_role) — revoked from public/anon/authenticated explicitly,
-- since a raw GRANT EXECUTE default would otherwise let any signed-in
-- user claim and complete arbitrary jobs for any organization.
create or replace function public.claim_next_jobs_system(p_limit int default 5)
returns setof public.job_queue language plpgsql security definer as $$
begin
  if not public.is_system_caller() then
    raise exception 'not authorized';
  end if;

  return query
    update public.job_queue
    set status = 'running', attempts = attempts + 1
    where id in (
      select id from public.job_queue
      where status in ('queued', 'retrying') and scheduled_for <= now()
      order by priority asc, scheduled_for asc
      limit p_limit
      for update skip locked
    )
    returning *;
end;
$$;
revoke execute on function public.claim_next_jobs_system(int) from public, anon, authenticated;
grant execute on function public.claim_next_jobs_system(int) to service_role;

create or replace function public.start_job_run_system(p_job_id uuid)
returns public.job_runs language plpgsql security definer as $$
declare
  v_row public.job_runs;
begin
  if not public.is_system_caller() then
    raise exception 'not authorized';
  end if;

  insert into public.job_runs (job_id, status) values (p_job_id, 'running') returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.start_job_run_system(uuid) from public, anon, authenticated;
grant execute on function public.start_job_run_system(uuid) to service_role;

create or replace function public.complete_job_system(p_job_id uuid, p_run_id uuid, p_output jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
begin
  if not public.is_system_caller() then
    raise exception 'not authorized';
  end if;

  update public.job_queue set status = 'completed' where id = p_job_id;
  update public.job_runs set status = 'completed', completed_at = now(), output = p_output where id = p_run_id;
end;
$$;
revoke execute on function public.complete_job_system(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_job_system(uuid, uuid, jsonb) to service_role;

create or replace function public.fail_job_system(p_job_id uuid, p_run_id uuid, p_error text)
returns void language plpgsql security definer as $$
declare
  v_job public.job_queue;
  v_policy public.retry_schedule;
  v_will_retry boolean;
begin
  if not public.is_system_caller() then
    raise exception 'not authorized';
  end if;

  select * into v_job from public.job_queue where id = p_job_id;
  select * into v_policy from public.retry_schedule where job_type = v_job.job_type;

  v_will_retry := v_job.attempts < coalesce(v_policy.max_attempts, 3);

  update public.job_queue set
    status = case when v_will_retry then 'retrying' else 'failed' end,
    scheduled_for = case when v_will_retry then now() + make_interval(secs => coalesce(v_policy.backoff_seconds, 300)) else scheduled_for end
  where id = p_job_id;

  update public.job_runs set status = 'failed', completed_at = now(), error = p_error where id = p_run_id;

  insert into public.job_failures (job_id, run_id, organization_id, job_type, error_message, will_retry)
  values (p_job_id, p_run_id, v_job.organization_id, v_job.job_type, p_error, v_will_retry);
end;
$$;
revoke execute on function public.fail_job_system(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fail_job_system(uuid, uuid, text) to service_role;

create or replace function public.resolve_job_failure(p_failure_id uuid)
returns public.job_failures language plpgsql security definer as $$
declare
  v_row public.job_failures;
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.job_failures where id = p_failure_id;
  if not (public.is_admin() or (v_org_id is not null and public.is_org_manager(v_org_id, auth.uid()))) then
    raise exception 'not authorized';
  end if;

  update public.job_failures set resolved = true where id = p_failure_id returning * into v_row;
  return v_row;
end;
$$;

-- ============================================================
-- 2. WIDEN EXISTING RPCS TO ALLOW TRUSTED SYSTEM CALLS
-- ============================================================
-- The cron worker calls these exact same functions a real user would —
-- no parallel "_system" business logic to duplicate and let drift.
create or replace function public.record_sales_activity(
  p_org_id uuid, p_activity_type text, p_agent_id uuid default null, p_task_id uuid default null,
  p_contact_email text default null, p_contact_name text default null, p_contact_company text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;

  insert into public.sales_activities (organization_id, activity_type, agent_id, task_id, contact_email, contact_name, contact_company, metadata)
  values (p_org_id, p_activity_type, p_agent_id, p_task_id, p_contact_email, p_contact_name, p_contact_company, p_metadata)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_meeting(
  p_org_id uuid, p_contact_email text, p_contact_name text default null,
  p_contact_company text default null, p_task_id uuid default null, p_estimated_value numeric default null
)
returns public.meetings language plpgsql security definer as $$
declare
  v_row public.meetings;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;

  insert into public.meetings (organization_id, contact_email, contact_name, contact_company, task_id, estimated_value, created_by)
  values (p_org_id, p_contact_email, p_contact_name, p_contact_company, p_task_id, p_estimated_value, auth.uid())
  returning * into v_row;

  perform public.record_sales_activity(p_org_id, 'meeting_booked', null, p_task_id, p_contact_email, p_contact_name, p_contact_company, '{}'::jsonb);

  return v_row;
end;
$$;

create or replace function public.generate_executive_brief(p_org_id uuid, p_period_type text)
returns public.executive_briefs language plpgsql security definer as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz := now();
  v_prev_start timestamptz;
  v_metrics record;
  v_prev_metrics record;
  v_meetings_count int;
  v_outcomes record;
  v_what_happened jsonb;
  v_what_worked jsonb := '[]'::jsonb;
  v_what_failed jsonb := '[]'::jsonb;
  v_what_changed jsonb := '[]'::jsonb;
  v_needs_attention jsonb := '[]'::jsonb;
  v_recommended jsonb;
  v_pending_approval int;
  v_row public.executive_briefs;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_system_caller()) then
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
  v_prev_start := v_period_start - (v_period_end - v_period_start);

  select
    count(*) filter (where activity_type = 'lead_found') as leads_found,
    count(*) filter (where activity_type = 'email_sent') as emails_sent,
    count(*) filter (where activity_type = 'reply_received') as replies_received
  into v_metrics
  from public.sales_activities
  where organization_id = p_org_id and created_at between v_period_start and v_period_end;

  select
    count(*) filter (where activity_type = 'email_sent') as emails_sent,
    count(*) filter (where activity_type = 'reply_received') as replies_received
  into v_prev_metrics
  from public.sales_activities
  where organization_id = p_org_id and created_at between v_prev_start and v_period_start;

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

  -- What Changed: this period vs. the immediately preceding period of
  -- the same length — a real comparison, not a guess at a trend.
  if coalesce(v_prev_metrics.emails_sent, 0) > 0 then
    if coalesce(v_metrics.emails_sent, 0) > v_prev_metrics.emails_sent then
      v_what_changed := v_what_changed || jsonb_build_array(format('Emails sent went up from %s to %s vs. the prior period.', v_prev_metrics.emails_sent, v_metrics.emails_sent));
    elsif coalesce(v_metrics.emails_sent, 0) < v_prev_metrics.emails_sent then
      v_what_changed := v_what_changed || jsonb_build_array(format('Emails sent dropped from %s to %s vs. the prior period.', v_prev_metrics.emails_sent, v_metrics.emails_sent));
    end if;
  end if;
  if coalesce(v_prev_metrics.replies_received, 0) > 0 or coalesce(v_metrics.replies_received, 0) > 0 then
    if coalesce(v_metrics.replies_received, 0) > coalesce(v_prev_metrics.replies_received, 0) then
      v_what_changed := v_what_changed || jsonb_build_array(format('Replies rose from %s to %s vs. the prior period.', coalesce(v_prev_metrics.replies_received, 0), v_metrics.replies_received));
    elsif coalesce(v_metrics.replies_received, 0) < coalesce(v_prev_metrics.replies_received, 0) then
      v_what_changed := v_what_changed || jsonb_build_array(format('Replies fell from %s to %s vs. the prior period.', coalesce(v_prev_metrics.replies_received, 0), coalesce(v_metrics.replies_received, 0)));
    end if;
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
      'what_changed', v_what_changed,
      'needs_attention', v_needs_attention,
      'recommended_actions', v_recommended
    )
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.record_organization_memory(p_org_id uuid, p_memory_type text, p_content jsonb)
returns public.organization_memory language plpgsql security definer as $$
declare
  v_row public.organization_memory;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_system_caller()) then
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

create or replace function public.get_business_outcomes(p_org_id uuid)
returns table (
  meetings_booked bigint,
  opportunities_created bigint,
  positive_replies bigint,
  pipeline_generated numeric
)
language plpgsql security definer stable as $$
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;

  return query
    select
      (select count(*) from public.meetings where organization_id = p_org_id),
      (select count(*) from public.meetings where organization_id = p_org_id and status in ('scheduled', 'completed')),
      (select count(distinct s.contact_email) from public.sales_activities s
        where s.organization_id = p_org_id and s.activity_type = 'reply_received'
        and s.contact_email in (select contact_email from public.meetings where organization_id = p_org_id)),
      (select coalesce(sum(estimated_value), 0) from public.meetings
        where organization_id = p_org_id and status in ('scheduled', 'completed') and estimated_value is not null);
end;
$$;

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
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
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
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
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

create or replace function public.get_organization_knowledge_graph(p_org_id uuid)
returns jsonb language plpgsql security definer stable as $$
declare
  v_nodes jsonb;
  v_edges jsonb;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
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

create or replace function public.get_performance_intelligence(p_org_id uuid)
returns jsonb language plpgsql security definer stable as $$
declare
  v_best_icp jsonb;
  v_best_message jsonb;
  v_best_agent jsonb;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
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
  if not (public.is_org_member(v_org_id, auth.uid()) or public.is_system_caller()) then
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

-- ============================================================
-- 3. AI SALES OPERATOR: reply classification + meeting detection
-- ============================================================
-- Written by the worker only (service-role insert, bypassing RLS) —
-- never something a user submits, so no insert policy for authenticated.
create table if not exists public.reply_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_activity_id uuid references public.sales_activities(id) on delete cascade,
  contact_email text not null,
  contact_name text,
  classification text not null check (classification in (
    'interested', 'not_interested', 'unsubscribe', 'objection', 'meeting_request', 'referral', 'wrong_contact'
  )),
  confidence numeric(4,3),
  reasoning text,
  action_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reply_classifications_org_idx on public.reply_classifications (organization_id, created_at desc);

alter table public.reply_classifications enable row level security;
create policy "reply_classifications_select" on public.reply_classifications for select using (public.is_org_member(organization_id, auth.uid()));

-- checkRepliesForOrganization() runs for a real user clicking "Check
-- Replies" just as often as it runs for the cron worker — so writing a
-- classification needs the same is_org_member-or-system bypass every
-- other RPC in this phase uses, not a direct insert (which only
-- service_role could reach).
create or replace function public.record_reply_classification(
  p_org_id uuid, p_sales_activity_id uuid, p_contact_email text, p_contact_name text,
  p_classification text, p_confidence numeric, p_reasoning text, p_action_items jsonb default '[]'::jsonb
)
returns public.reply_classifications language plpgsql security definer as $$
declare
  v_row public.reply_classifications;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;
  if p_classification not in ('interested', 'not_interested', 'unsubscribe', 'objection', 'meeting_request', 'referral', 'wrong_contact') then
    raise exception 'invalid classification %', p_classification;
  end if;

  insert into public.reply_classifications (organization_id, sales_activity_id, contact_email, contact_name, classification, confidence, reasoning, action_items)
  values (p_org_id, p_sales_activity_id, p_contact_email, p_contact_name, p_classification, p_confidence, p_reasoning, p_action_items)
  returning * into v_row;

  return v_row;
end;
$$;

-- Follow-up intelligence: which real conversations have gone quiet after
-- something that needed a response — ordered so the most overdue comes
-- first. Every input is a real, already-logged classification/activity;
-- nothing here is invented.
create or replace function public.get_next_best_action(p_org_id uuid)
returns table (contact_email text, contact_name text, classification text, days_since int, suggested_action text)
language plpgsql security definer stable as $$
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;

  return query
    with latest as (
      select distinct on (rc.contact_email) rc.contact_email, rc.contact_name, rc.classification, rc.created_at
      from public.reply_classifications rc
      where rc.organization_id = p_org_id
      order by rc.contact_email, rc.created_at desc
    )
    select
      l.contact_email,
      l.contact_name,
      l.classification,
      extract(day from now() - l.created_at)::int,
      case l.classification
        when 'objection' then 'Address their objection with a tailored follow-up.'
        when 'interested' then 'Follow up to schedule a meeting before interest cools.'
        when 'meeting_request' then 'Confirm meeting time and send a calendar invite.'
        else 'Follow up.'
      end
    from latest l
    where l.classification in ('objection', 'interested', 'meeting_request')
      and not exists (
        select 1 from public.sales_activities s
        where s.organization_id = p_org_id and s.contact_email = l.contact_email
          and s.activity_type in ('email_sent', 'meeting_booked')
          and s.created_at > l.created_at
      )
    order by l.created_at asc;
end;
$$;

-- ============================================================
-- 4. OPPORTUNITY DETECTION
-- ============================================================
create or replace function public.get_opportunities(p_org_id uuid)
returns jsonb language plpgsql security definer stable as $$
declare
  v_stalled boolean;
  v_high_value jsonb;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin() or public.is_system_caller()) then
    raise exception 'not authorized';
  end if;

  select (
    exists (select 1 from public.organization_goals where organization_id = p_org_id and title = 'Generate Leads' and not is_paused and status <> 'completed')
    and not exists (select 1 from public.sales_activities where organization_id = p_org_id and created_at > now() - interval '7 days')
  ) into v_stalled;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_high_value from (
    select contact_email, contact_name, estimated_value
    from public.meetings
    where organization_id = p_org_id and estimated_value is not null and status in ('scheduled', 'completed')
    order by estimated_value desc
    limit 5
  ) t;

  return jsonb_build_object(
    'stalled_campaign', v_stalled,
    'high_value_prospects', v_high_value,
    'winning_icp', (select content->'icp' from public.organization_memory where organization_id = p_org_id and memory_type = 'icp_result' order by (content->>'reply_rate')::numeric desc nulls last limit 1),
    'failing_icp', (select content->'icp' from public.organization_memory where organization_id = p_org_id and memory_type = 'icp_result' order by (content->>'reply_rate')::numeric asc nulls last limit 1)
  );
end;
$$;

-- ============================================================
-- 5. REVENUE OPERATING SYSTEM: deal outcomes + attribution
-- ============================================================
-- A meeting's estimated_value is "pipeline" until a human tells the
-- system whether the deal it represents actually closed — won or lost,
-- and for how much. Real, human-entered numbers only, same as
-- estimated_value itself.
alter table public.meetings add column if not exists deal_outcome text check (deal_outcome in ('won', 'lost'));
alter table public.meetings add column if not exists deal_value numeric(14,2);
alter table public.meetings add column if not exists deal_closed_at timestamptz;

create or replace function public.record_deal_outcome(p_meeting_id uuid, p_outcome text, p_value numeric default null)
returns public.meetings language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_row public.meetings;
begin
  select organization_id into v_org_id from public.meetings where id = p_meeting_id;
  if v_org_id is null then
    raise exception 'meeting not found';
  end if;
  if not public.is_org_member(v_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_outcome not in ('won', 'lost') then
    raise exception 'invalid outcome %', p_outcome;
  end if;

  update public.meetings set deal_outcome = p_outcome, deal_value = p_value, deal_closed_at = now()
  where id = p_meeting_id
  returning * into v_row;

  perform public.log_audit_event(v_org_id, 'deal_outcome_recorded', 'meeting', p_meeting_id, jsonb_build_object('outcome', p_outcome, 'value', p_value));

  return v_row;
end;
$$;

-- Attribution walks real joins only: a won deal's meeting timestamp
-- against the ICP period that was live then (organization_memory), and
-- its contact against any subject-line experiment assignment — no
-- modeling, no inference.
create or replace function public.get_revenue_attribution(p_org_id uuid)
returns jsonb language plpgsql security definer stable as $$
declare
  v_by_icp jsonb;
  v_by_subject jsonb;
  v_pipeline numeric;
  v_won numeric;
  v_lost numeric;
begin
  if not (public.is_org_member(p_org_id, auth.uid()) or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  select coalesce(sum(estimated_value), 0) into v_pipeline from public.meetings where organization_id = p_org_id and deal_outcome is null and estimated_value is not null;
  select coalesce(sum(deal_value), 0) into v_won from public.meetings where organization_id = p_org_id and deal_outcome = 'won';
  select coalesce(sum(deal_value), 0) into v_lost from public.meetings where organization_id = p_org_id and deal_outcome = 'lost';

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_by_icp from (
    select coalesce(om.content->'icp'->>'targetIndustry', 'Unknown') as industry, sum(m.deal_value) as revenue_won
    from public.meetings m
    left join public.organization_memory om on om.organization_id = m.organization_id and om.memory_type = 'icp_result'
      and m.created_at between (om.content->>'period_start')::timestamptz and (om.content->>'period_end')::timestamptz
    where m.organization_id = p_org_id and m.deal_outcome = 'won'
    group by 1
  ) t;

  select coalesce(jsonb_agg(row_to_json(t2)), '[]'::jsonb) into v_by_subject from (
    select
      case when ea.variant = 'a' then e.variant_a->>'subject_line' when ea.variant = 'b' then e.variant_b->>'subject_line' else 'No experiment' end as subject_line,
      sum(m.deal_value) as revenue_won
    from public.meetings m
    left join public.experiment_assignments ea on ea.contact_email = m.contact_email
    left join public.experiments e on e.id = ea.experiment_id and e.organization_id = m.organization_id
    where m.organization_id = p_org_id and m.deal_outcome = 'won'
    group by 1
  ) t2;

  return jsonb_build_object('pipeline_open', v_pipeline, 'revenue_won', v_won, 'revenue_lost', v_lost, 'by_icp', v_by_icp, 'by_subject_line', v_by_subject);
end;
$$;

-- ============================================================
-- 6. AUDIT SYSTEM
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_org_idx on public.audit_log (organization_id, created_at desc);

alter table public.audit_log enable row level security;
create policy "audit_log_select" on public.audit_log for select using (
  public.is_admin() or (organization_id is not null and public.is_org_manager(organization_id, auth.uid()))
);

create or replace function public.log_audit_event(p_org_id uuid, p_action text, p_target_type text default null, p_target_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
begin
  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (p_org_id, auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

-- Redefine the small set of sensitive actions this phase asks to audit —
-- same bodies as before, with one added `perform log_audit_event(...)`.
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

  perform public.log_audit_event(p_org_id, 'autonomy_level_changed', 'organization_executive', p_org_id, jsonb_build_object('level', p_level));

  return v_row;
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
  if not (public.is_org_manager(v_org_id, auth.uid()) or public.is_system_caller()) then
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

  if v_winner in ('a', 'b') and (select autonomy_level from public.organization_executive where organization_id = v_org_id) = 4 then
    update public.organization_executive
    set default_subject_line = (case when v_winner = 'a' then v_row.variant_a else v_row.variant_b end)->>'subject_line'
    where organization_id = v_org_id;
  end if;

  perform public.log_audit_event(v_org_id, 'experiment_concluded', 'experiment', p_experiment_id, jsonb_build_object('winner', v_winner));

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

  perform public.log_audit_event(v_org_id, 'experiment_winner_applied', 'experiment', p_experiment_id, '{}'::jsonb);

  return v_row;
end;
$$;

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

  perform public.log_audit_event(p_org_id, 'revenue_event_recorded', 'revenue_events', v_row.id, jsonb_build_object('event_type', p_event_type, 'amount', p_amount));

  return v_row;
end;
$$;

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
  if not (public.is_org_member(v_org_id, auth.uid()) or public.is_system_caller()) then
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

  perform public.log_audit_event(v_org_id, 'campaign_launched', 'organization_goals', p_goal_id, jsonb_build_object('industry', p_target_industry));

  return v_row;
end;
$$;

-- ============================================================
-- 7. PERFORMANCE: MATERIALIZED DAILY ROLLUP
-- ============================================================
-- Written only by the worker (service-role upsert) — a real incremental
-- alternative to scanning all of sales_activities on every brief/health
-- read. Not yet wired to replace those reads everywhere (a full
-- migration of every existing full-history query to read from this
-- table is future work); this phase establishes the table and the job
-- that populates it daily.
create table if not exists public.organization_metrics_daily (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_date date not null,
  leads_found int not null default 0,
  emails_sent int not null default 0,
  replies_received int not null default 0,
  meetings_booked int not null default 0,
  primary key (organization_id, metric_date)
);

alter table public.organization_metrics_daily enable row level security;
create policy "organization_metrics_daily_select" on public.organization_metrics_daily for select using (
  public.is_org_member(organization_id, auth.uid()) or public.is_admin()
);

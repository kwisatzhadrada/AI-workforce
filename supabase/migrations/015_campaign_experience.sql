-- ============================================================
-- Campaign Experience Sprint
-- No new architecture — this migration adds the minimum needed to turn
-- the existing B2B Sales pipeline into a guided, non-technical campaign
-- flow with a real human approval gate before any email actually sends:
-- three columns on the existing `tasks` table, one approval RPC, one
-- organization-level "average deal value" field + setter for the ROI
-- dashboard, and an extension of the existing sales metrics function to
-- report it. Pause/Stop campaign controls need NO new schema at all —
-- `organization_goals.is_paused` (Phase 6) and `setGoalStatus(..., 'failed')`
-- (already in lib/goals.ts) already do exactly that.
-- ============================================================

-- ============================================================
-- 1. HUMAN APPROVAL GATE
-- ============================================================
-- Generic "this task's output needs a human's sign-off before anything
-- downstream should trust it" concept — not outreach-specific in the
-- schema, even though outreach (drafted emails) is the only capability
-- that sets requires_approval today. A future capability could reuse the
-- same three columns without another migration.
alter table public.tasks add column if not exists requires_approval boolean not null default false;
alter table public.tasks add column if not exists approved_at timestamptz;
alter table public.tasks add column if not exists approved_by uuid references public.profiles(id) on delete set null;

alter table public.organization_activity drop constraint if exists organization_activity_activity_type_check;
alter table public.organization_activity add constraint organization_activity_activity_type_check
  check (activity_type in (
    'member_joined', 'member_removed', 'agent_joined', 'agent_removed',
    'department_created', 'verification_earned', 'trust_score_changed',
    'assignment_completed', 'workflow_completed',
    'goal_created', 'goal_completed', 'goal_failed', 'plan_approved',
    'recommendation_applied',
    'integration_connected', 'integration_disconnected', 'integration_error',
    'task_output_approved'
  ));

-- Approving is a supervisor action (same bar as approve_goal_plan) — set
-- by the human reviewing drafted outreach, never by the runtime itself.
create or replace function public.approve_task_output(p_task_id uuid)
returns public.tasks language plpgsql security definer as $$
declare
  v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'task not found';
  end if;
  if not public.is_org_supervisor(v_task.organization_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if not v_task.requires_approval then
    raise exception 'this task does not require approval';
  end if;

  update public.tasks set approved_at = now(), approved_by = auth.uid()
  where id = p_task_id
  returning * into v_task;

  perform public.log_organization_activity(v_task.organization_id, 'task_output_approved', jsonb_build_object('task_id', p_task_id, 'task_title', v_task.title));

  return v_task;
end;
$$;

-- ============================================================
-- 2. ROI: AVERAGE DEAL VALUE + ESTIMATED PIPELINE VALUE
-- ============================================================
alter table public.organizations add column if not exists avg_deal_value numeric(14,2);

create or replace function public.set_avg_deal_value(p_org_id uuid, p_value numeric)
returns void language plpgsql security definer as $$
begin
  if not public.is_org_manager(p_org_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_value is not null and p_value < 0 then
    raise exception 'average deal value cannot be negative';
  end if;

  update public.organizations set avg_deal_value = p_value where id = p_org_id;
end;
$$;

-- Extends the Phase 10 function with two more columns rather than adding
-- a second RPC — same shape, same caller-RLS-only trust model, just a
-- richer read. Widening a `returns table` signature requires a real drop
-- first (CREATE OR REPLACE cannot change a function's return type), so
-- this actually needs the explicit drop below — every migration up to
-- and including 013 already ran and left the 5-column version in place
-- even on a completely fresh deployment.
drop function if exists public.get_sales_metrics(uuid);
create or replace function public.get_sales_metrics(p_org_id uuid)
returns table (
  leads_found bigint, emails_sent bigint, replies_received bigint, meetings_booked bigint,
  reply_rate numeric, avg_deal_value numeric, estimated_pipeline_value numeric
)
language sql stable as $$
  select
    count(*) filter (where a.activity_type = 'lead_found'),
    count(*) filter (where a.activity_type = 'email_sent'),
    count(*) filter (where a.activity_type = 'reply_received'),
    count(*) filter (where a.activity_type = 'meeting_booked'),
    case when count(*) filter (where a.activity_type = 'email_sent') > 0
      then round(count(*) filter (where a.activity_type = 'reply_received')::numeric / count(*) filter (where a.activity_type = 'email_sent') * 100, 2)
      else 0 end,
    o.avg_deal_value,
    coalesce(o.avg_deal_value, 0) * count(*) filter (where a.activity_type = 'meeting_booked')
  from public.organizations o
  left join public.sales_activities a on a.organization_id = o.id
  where o.id = p_org_id
  group by o.avg_deal_value;
$$;

-- ============================================================
-- 3. SECURITY HARDENING
-- ============================================================
-- Nothing else in this migration is called directly by app code without
-- its own authorization check — approve_task_output and
-- set_avg_deal_value both check the acting user themselves, matching the
-- established pattern (see the Stabilization Sprint 1 migration's own
-- section 4/5 notes on this exact convention).

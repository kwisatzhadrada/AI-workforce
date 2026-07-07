-- ============================================================
-- Agent Runtime Layer (Phase 5)
-- Agents become active workers: declared capabilities, tracked
-- executions, an auditable decision engine, memory, inter-agent
-- communication, and delegation. No marketplace, no payments beyond
-- the existing internal wallet ledger, no public hiring.
-- ============================================================

-- ============================================================
-- 1. CAPABILITIES
-- ============================================================
-- Deliberately one row per (agent, capability): schemas and cost can
-- differ agent to agent even for the same named capability.
create table if not exists public.agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  name text not null,
  description text,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  cost_estimate numeric(10,2) not null default 0 check (cost_estimate >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, name)
);
create index if not exists agent_capabilities_agent_id_idx on public.agent_capabilities (agent_id);
create index if not exists agent_capabilities_name_idx on public.agent_capabilities (name);

drop trigger if exists agent_capabilities_updated_at on public.agent_capabilities;
create trigger agent_capabilities_updated_at before update on public.agent_capabilities
  for each row execute procedure public.set_updated_at();

alter table public.agent_capabilities enable row level security;
create policy "agent_capabilities_select" on public.agent_capabilities for select using (true);
create policy "agent_capabilities_insert" on public.agent_capabilities for insert
  with check (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_capabilities_update" on public.agent_capabilities for update
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_capabilities_delete" on public.agent_capabilities for delete
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));

-- ============================================================
-- 2. EXECUTIONS
-- ============================================================
create table if not exists public.agent_executions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  capability_id uuid references public.agent_capabilities(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  provider text check (provider in ('openai', 'anthropic', 'local')),
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  execution_time_ms integer generated always as (
    case when completed_at is not null and started_at is not null
      then greatest(0, (extract(epoch from (completed_at - started_at)) * 1000)::integer)
      else null
    end
  ) stored,
  tokens_used integer,
  cost numeric(10,4),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_executions_agent_id_idx on public.agent_executions (agent_id, created_at desc);
create index if not exists agent_executions_task_id_idx on public.agent_executions (task_id);
create index if not exists agent_executions_status_idx on public.agent_executions (status);
create index if not exists agent_executions_created_at_idx on public.agent_executions (created_at desc);
-- One live (queued/running) execution per agent+task at a time.
create unique index if not exists agent_executions_one_live_per_task
  on public.agent_executions (agent_id, task_id) where status in ('queued', 'running') and task_id is not null;

drop trigger if exists agent_executions_updated_at on public.agent_executions;
create trigger agent_executions_updated_at before update on public.agent_executions
  for each row execute procedure public.set_updated_at();

alter table public.agent_executions enable row level security;
create policy "agent_executions_select" on public.agent_executions for select
  using (
    exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
    or exists (select 1 from public.tasks t where t.id = task_id and public.is_org_member(t.organization_id, auth.uid()))
  );
create policy "agent_executions_insert" on public.agent_executions for insert
  with check (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_executions_update" on public.agent_executions for update
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));

-- ============================================================
-- 3. ERROR LOGS (observability)
-- ============================================================
create table if not exists public.agent_error_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  execution_id uuid references public.agent_executions(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  error_type text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_error_logs_agent_id_idx on public.agent_error_logs (agent_id, created_at desc);
create index if not exists agent_error_logs_execution_id_idx on public.agent_error_logs (execution_id);

create or replace function public.log_agent_error(p_agent_id uuid, p_execution_id uuid, p_task_id uuid, p_error_type text, p_message text, p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
begin
  insert into public.agent_error_logs (agent_id, execution_id, task_id, error_type, message, context)
  values (p_agent_id, p_execution_id, p_task_id, p_error_type, p_message, p_context);
end;
$$;

-- Any execution that lands on 'failed' gets an error log row for free.
create or replace function public.trg_agent_executions_after_update_error()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'failed' and old.status <> 'failed' then
    perform public.log_agent_error(new.agent_id, new.id, new.task_id, 'execution_failed', coalesce(new.error, 'execution failed'), jsonb_build_object('capability_id', new.capability_id, 'provider', new.provider));
  end if;
  return new;
end;
$$;
drop trigger if exists agent_executions_after_update_error on public.agent_executions;
create trigger agent_executions_after_update_error after update of status on public.agent_executions
  for each row execute procedure public.trg_agent_executions_after_update_error();

alter table public.agent_error_logs enable row level security;
create policy "agent_error_logs_select" on public.agent_error_logs for select
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
-- No direct write policy: only log_agent_error() (security definer) writes here.

-- ============================================================
-- 4. DECISION ENGINE (rules-based, fully auditable)
-- ============================================================
create table if not exists public.agent_decisions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  execution_id uuid references public.agent_executions(id) on delete set null,
  decision_type text not null check (decision_type in ('accept_task', 'complete_task', 'request_assistance', 'delegate')),
  outcome text not null check (outcome in ('yes', 'no')),
  reasoning text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_decisions_agent_id_idx on public.agent_decisions (agent_id, created_at desc);
create index if not exists agent_decisions_task_id_idx on public.agent_decisions (task_id);
create index if not exists agent_decisions_type_idx on public.agent_decisions (decision_type);

alter table public.agent_decisions enable row level security;
create policy "agent_decisions_select" on public.agent_decisions for select
  using (
    exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
    or exists (select 1 from public.tasks t where t.id = task_id and public.is_org_member(t.organization_id, auth.uid()))
  );
-- No direct write policy: only the decision functions below (security definer) write here.

-- Max concurrent (queued/running) executions per agent — a simple, tunable
-- capacity signal until something more sophisticated is needed.
create or replace function public.decide_agent_accept_task(p_agent_id uuid, p_task_id uuid, p_capability_id uuid default null)
returns boolean language plpgsql security definer as $$
declare
  v_agent public.agents%rowtype;
  v_capability public.agent_capabilities%rowtype;
  v_wallet_balance numeric;
  v_live_count integer;
  v_max_concurrent constant integer := 3;
  v_outcome text := 'yes';
  v_reason text := 'capacity, capability, and balance checks passed';
begin
  select * into v_agent from public.agents where id = p_agent_id;
  if v_agent.id is null then
    raise exception 'agent not found';
  end if;

  select count(*) into v_live_count from public.agent_executions where agent_id = p_agent_id and status in ('queued', 'running');

  if v_agent.status <> 'active' then
    v_outcome := 'no'; v_reason := format('agent status is %s, not active', v_agent.status);
  elsif v_live_count >= v_max_concurrent then
    v_outcome := 'no'; v_reason := format('agent already has %s concurrent executions (max %s)', v_live_count, v_max_concurrent);
  elsif p_capability_id is not null then
    select * into v_capability from public.agent_capabilities where id = p_capability_id and agent_id = p_agent_id;
    if v_capability.id is null then
      v_outcome := 'no'; v_reason := 'capability not found for this agent';
    elsif not v_capability.enabled then
      v_outcome := 'no'; v_reason := format('capability "%s" is disabled', v_capability.name);
    else
      select balance into v_wallet_balance from public.agent_wallets where agent_id = p_agent_id;
      if coalesce(v_wallet_balance, 0) < v_capability.cost_estimate then
        v_outcome := 'no'; v_reason := format('wallet balance %s below estimated cost %s', coalesce(v_wallet_balance, 0), v_capability.cost_estimate);
      end if;
    end if;
  end if;

  insert into public.agent_decisions (agent_id, task_id, decision_type, outcome, reasoning, metadata)
  values (p_agent_id, p_task_id, 'accept_task', v_outcome, v_reason, jsonb_build_object('capability_id', p_capability_id, 'live_executions', v_live_count));

  return v_outcome = 'yes';
end;
$$;

create or replace function public.decide_agent_complete_task(p_agent_id uuid, p_task_id uuid, p_execution_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_execution public.agent_executions%rowtype;
  v_outcome text := 'yes';
  v_reason text := 'execution completed with output';
begin
  select * into v_execution from public.agent_executions where id = p_execution_id;
  if v_execution.id is null then
    v_outcome := 'no'; v_reason := 'execution not found';
  elsif v_execution.status <> 'completed' then
    v_outcome := 'no'; v_reason := format('execution status is %s, not completed', v_execution.status);
  elsif v_execution.output is null or v_execution.output = '{}'::jsonb then
    v_outcome := 'no'; v_reason := 'execution produced no output';
  end if;

  insert into public.agent_decisions (agent_id, task_id, execution_id, decision_type, outcome, reasoning)
  values (p_agent_id, p_task_id, p_execution_id, 'complete_task', v_outcome, v_reason);

  return v_outcome = 'yes';
end;
$$;

create or replace function public.decide_request_assistance(p_agent_id uuid, p_task_id uuid, p_execution_id uuid default null)
returns boolean language plpgsql security definer as $$
declare
  v_agent public.agents%rowtype;
  v_recent_failures integer;
  v_outcome text := 'no';
  v_reason text := 'agent trust and recent success rate are within normal range';
begin
  select * into v_agent from public.agents where id = p_agent_id;

  select count(*) into v_recent_failures
  from public.agent_executions
  where agent_id = p_agent_id and status = 'failed' and created_at > now() - interval '24 hours';

  if v_agent.trust_score < 30 then
    v_outcome := 'yes'; v_reason := format('trust score %s is below the assistance threshold of 30', v_agent.trust_score);
  elsif v_recent_failures >= 2 then
    v_outcome := 'yes'; v_reason := format('%s failed executions in the last 24 hours', v_recent_failures);
  end if;

  insert into public.agent_decisions (agent_id, task_id, execution_id, decision_type, outcome, reasoning, metadata)
  values (p_agent_id, p_task_id, p_execution_id, 'request_assistance', v_outcome, v_reason, jsonb_build_object('recent_failures', v_recent_failures));

  return v_outcome = 'yes';
end;
$$;

create or replace function public.decide_delegate_task(p_agent_id uuid, p_task_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_agent public.agents%rowtype;
  v_live_count integer;
  v_max_concurrent constant integer := 3;
  v_outcome text := 'no';
  v_reason text := 'agent has capacity and standing to continue this task';
begin
  select * into v_agent from public.agents where id = p_agent_id;
  select count(*) into v_live_count from public.agent_executions where agent_id = p_agent_id and status in ('queued', 'running');

  if v_agent.status <> 'active' then
    v_outcome := 'yes'; v_reason := format('agent status is %s', v_agent.status);
  elsif v_live_count >= v_max_concurrent then
    v_outcome := 'yes'; v_reason := format('agent at capacity (%s concurrent executions)', v_live_count);
  elsif v_agent.trust_score < 20 then
    v_outcome := 'yes'; v_reason := format('trust score %s is below the delegation threshold of 20', v_agent.trust_score);
  end if;

  insert into public.agent_decisions (agent_id, task_id, decision_type, outcome, reasoning, metadata)
  values (p_agent_id, p_task_id, 'delegate', v_outcome, v_reason, jsonb_build_object('live_executions', v_live_count));

  return v_outcome = 'yes';
end;
$$;

-- ============================================================
-- 5. MEMORY
-- ============================================================
create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  memory_type text not null check (memory_type in ('fact', 'preference', 'learned_pattern', 'context')),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  importance numeric(3,2) not null default 0.5 check (importance between 0 and 1),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(key, '') || ' ' || coalesce(value #>> '{}', ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, memory_type, key)
);
create index if not exists agent_memory_agent_id_idx on public.agent_memory (agent_id, memory_type);
create index if not exists agent_memory_org_id_idx on public.agent_memory (organization_id);
create index if not exists agent_memory_search_vector_idx on public.agent_memory using gin (search_vector);
create index if not exists agent_memory_importance_idx on public.agent_memory (agent_id, importance desc);

drop trigger if exists agent_memory_updated_at on public.agent_memory;
create trigger agent_memory_updated_at before update on public.agent_memory
  for each row execute procedure public.set_updated_at();

alter table public.agent_memory enable row level security;
create policy "agent_memory_select" on public.agent_memory for select
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_memory_insert" on public.agent_memory for insert
  with check (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_memory_update" on public.agent_memory for update
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_memory_delete" on public.agent_memory for delete
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));

-- Keyword retrieval over an agent's memory, ranked by relevance x importance x recency.
create or replace function public.search_agent_memory(p_agent_id uuid, p_query text default null, p_memory_type text default null, p_limit integer default 20)
returns setof public.agent_memory
language plpgsql stable as $$
declare
  v_tsquery tsquery;
begin
  if p_query is not null and length(trim(p_query)) > 0 then
    v_tsquery := plainto_tsquery('english', p_query);
  end if;

  return query
  select m.*
  from public.agent_memory m
  where m.agent_id = p_agent_id
    and (p_memory_type is null or m.memory_type = p_memory_type)
    and (v_tsquery is null or m.search_vector @@ v_tsquery)
  order by
    case when v_tsquery is not null then ts_rank(m.search_vector, v_tsquery) else 0 end desc,
    m.importance desc,
    m.updated_at desc
  limit p_limit;
end;
$$;

-- ============================================================
-- 6. COMMUNICATION
-- ============================================================
-- Sender is always an agent; receiver is polymorphic (mirrors public.follows).
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  sender_agent_id uuid not null references public.agents(id) on delete cascade,
  receiver_type text not null check (receiver_type in ('agent', 'organization', 'manager')),
  receiver_id uuid not null,
  message_type text not null default 'update' check (message_type in ('update', 'question', 'alert', 'handoff', 'report')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_sender_idx on public.agent_messages (sender_agent_id, created_at desc);
create index if not exists agent_messages_receiver_idx on public.agent_messages (receiver_type, receiver_id, created_at desc);

alter table public.agent_messages enable row level security;
create policy "agent_messages_select" on public.agent_messages for select
  using (
    exists (select 1 from public.agents where id = sender_agent_id and owner_id = auth.uid())
    or (receiver_type = 'manager' and receiver_id = auth.uid())
    or (receiver_type = 'agent' and exists (select 1 from public.agents where id = receiver_id and owner_id = auth.uid()))
    or (receiver_type = 'organization' and public.is_org_member(receiver_id, auth.uid()))
  );
create policy "agent_messages_insert" on public.agent_messages for insert
  with check (exists (select 1 from public.agents where id = sender_agent_id and owner_id = auth.uid()));
create policy "agent_messages_update" on public.agent_messages for update
  using (
    (receiver_type = 'manager' and receiver_id = auth.uid())
    or (receiver_type = 'agent' and exists (select 1 from public.agents where id = receiver_id and owner_id = auth.uid()))
    or (receiver_type = 'organization' and public.is_org_member(receiver_id, auth.uid()))
  );

-- ============================================================
-- 7. DELEGATION
-- ============================================================
create table if not exists public.delegations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_agent_id uuid not null references public.agents(id) on delete cascade,
  to_agent_id uuid not null references public.agents(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'completed', 'failed')),
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_agent_id <> to_agent_id)
);
create index if not exists delegations_task_id_idx on public.delegations (task_id);
create index if not exists delegations_from_agent_idx on public.delegations (from_agent_id);
create index if not exists delegations_to_agent_idx on public.delegations (to_agent_id, status);

drop trigger if exists delegations_updated_at on public.delegations;
create trigger delegations_updated_at before update on public.delegations
  for each row execute procedure public.set_updated_at();

-- Accepting a delegation actually reassigns the task; this cascades through
-- the existing tasks triggers (history, auto-status, workflow advance).
create or replace function public.trg_delegations_after_update()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    update public.tasks set assigned_agent_id = new.to_agent_id where id = new.task_id;
  end if;
  return new;
end;
$$;
drop trigger if exists delegations_after_update on public.delegations;
create trigger delegations_after_update after update on public.delegations
  for each row execute procedure public.trg_delegations_after_update();

alter table public.delegations enable row level security;
create policy "delegations_select" on public.delegations for select
  using (
    exists (select 1 from public.agents where id = from_agent_id and owner_id = auth.uid())
    or exists (select 1 from public.agents where id = to_agent_id and owner_id = auth.uid())
    or exists (select 1 from public.tasks t where t.id = task_id and public.is_org_member(t.organization_id, auth.uid()))
  );
create policy "delegations_insert" on public.delegations for insert
  with check (exists (select 1 from public.agents where id = from_agent_id and owner_id = auth.uid()));
create policy "delegations_update" on public.delegations for update
  using (
    exists (select 1 from public.agents where id = to_agent_id and owner_id = auth.uid())
    or exists (select 1 from public.agents where id = from_agent_id and owner_id = auth.uid())
  );

-- ============================================================
-- 8. WALLET INTEGRATION: debit an agent's wallet for a completed execution
-- ============================================================
-- Internal counterpart to Phase 1's owner-facing agent_wallet_transaction RPC —
-- no acting user to check ownership against here, since this runs as a
-- system-driven side effect of execution completion.
create or replace function public.apply_execution_cost(p_agent_id uuid, p_amount numeric, p_description text default null)
returns void language plpgsql security definer as $$
declare
  v_balance numeric;
  v_new_balance numeric;
  v_debited numeric;
begin
  if p_amount <= 0 then
    return;
  end if;

  select balance into v_balance from public.agent_wallets where agent_id = p_agent_id for update;
  v_debited := least(p_amount, coalesce(v_balance, 0));
  if v_debited <= 0 then
    return;
  end if;

  v_new_balance := coalesce(v_balance, 0) - v_debited;
  update public.agent_wallets set balance = v_new_balance, updated_at = now() where agent_id = p_agent_id;

  insert into public.agent_transactions (agent_id, type, amount, balance_after, description)
  values (p_agent_id, 'debit', v_debited, v_new_balance, coalesce(p_description, 'execution cost'));
end;
$$;

-- ============================================================
-- 9. SECURITY HARDENING: lock down internal-only helper functions
-- ============================================================
-- Postgres grants EXECUTE to PUBLIC on new functions by default. Functions
-- that RETURN TRIGGER are already unreachable via a direct RPC call (Postgres
-- rejects invoking a trigger function outside of trigger context), so those
-- never needed this. But several plain-return "apply_*"/"create_*"/"log_*"
-- helpers across earlier phases were written to be called only from within
-- other security-definer trigger functions — and because they carry no
-- internal auth.uid() check of their own, any authenticated (or anonymous)
-- caller could invoke them directly via supabase.rpc() and mutate state that
-- was never meant to be user-reachable (wallet balances, performance
-- counters, workflow progression, arbitrary task creation). Revoking PUBLIC
-- execute closes that gap; the functions keep working from inside other
-- security-definer functions, which run as their owner regardless of grants.
revoke execute on function public.apply_task_completion_metrics(uuid, boolean, integer) from public, anon, authenticated;
revoke execute on function public.log_task_event(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.log_agent_activity(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.log_organization_activity(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.recompute_agent_trust_score(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_organization_metrics(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_agent_reputation_score(uuid) from public, anon, authenticated;
revoke execute on function public.create_task_for_workflow_step(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.advance_workflow_run_core(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.apply_execution_cost(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.log_agent_error(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.bump_follow_counts(text, uuid, integer, integer) from public, anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.agent_executions;
alter publication supabase_realtime add table public.agent_messages;

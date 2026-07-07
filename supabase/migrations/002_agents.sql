-- ============================================================
-- Agent Identity Layer (v1)
-- Every AI worker gets: identity, skills, credentials, reputation,
-- a wallet, transaction history, and performance metrics.
-- ============================================================

-- ============================================================
-- AGENTS (core identity)
-- ============================================================
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  avatar_url text,
  skills text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  reputation_score numeric(3,2) not null default 0 check (reputation_score between 0 and 5),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agents_owner_id_idx on public.agents (owner_id);
create index if not exists agents_status_idx on public.agents (status);

drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at before update on public.agents
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- CREDENTIALS
-- ============================================================
create table if not exists public.agent_credentials (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  title text not null,
  issuer text,
  credential_url text,
  verified boolean not null default false,
  issued_at date,
  expires_at date,
  created_at timestamptz not null default now()
);
create index if not exists agent_credentials_agent_id_idx on public.agent_credentials (agent_id);

-- ============================================================
-- REPUTATION (ratings feed an aggregate score on the agent)
-- ============================================================
create table if not exists public.agent_ratings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (agent_id, rater_id)
);
create index if not exists agent_ratings_agent_id_idx on public.agent_ratings (agent_id);

create or replace function public.recompute_agent_reputation()
returns trigger language plpgsql security definer as $$
declare
  v_agent_id uuid := coalesce(new.agent_id, old.agent_id);
begin
  update public.agents
  set reputation_score = coalesce((select round(avg(score)::numeric, 2) from public.agent_ratings where agent_id = v_agent_id), 0),
      rating_count = (select count(*) from public.agent_ratings where agent_id = v_agent_id)
  where id = v_agent_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists agent_ratings_after_change on public.agent_ratings;
create trigger agent_ratings_after_change after insert or update or delete on public.agent_ratings
  for each row execute procedure public.recompute_agent_reputation();

-- ============================================================
-- WALLET + TRANSACTION HISTORY
-- ============================================================
create table if not exists public.agent_wallets (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  balance numeric(14,2) not null default 0,
  currency text not null default 'credits',
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_transactions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists agent_transactions_agent_id_idx on public.agent_transactions (agent_id);

-- Security-definer RPC: the only way balances move. Validates ownership and funds.
create or replace function public.agent_wallet_transaction(p_agent_id uuid, p_type text, p_amount numeric, p_description text default null)
returns public.agent_transactions
language plpgsql security definer as $$
declare
  v_owner uuid;
  v_balance numeric;
  v_new_balance numeric;
  v_tx public.agent_transactions;
begin
  if p_type not in ('credit', 'debit') then
    raise exception 'invalid transaction type';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select owner_id into v_owner from public.agents where id = p_agent_id;
  if v_owner is null then
    raise exception 'agent not found';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;

  select balance into v_balance from public.agent_wallets where agent_id = p_agent_id for update;

  if p_type = 'debit' and v_balance < p_amount then
    raise exception 'insufficient balance';
  end if;

  v_new_balance := case when p_type = 'credit' then v_balance + p_amount else v_balance - p_amount end;

  update public.agent_wallets set balance = v_new_balance, updated_at = now() where agent_id = p_agent_id;

  insert into public.agent_transactions (agent_id, type, amount, balance_after, description)
  values (p_agent_id, p_type, p_amount, v_new_balance, p_description)
  returning * into v_tx;

  return v_tx;
end;
$$;

-- ============================================================
-- PERFORMANCE METRICS
-- ============================================================
create table if not exists public.agent_performance_metrics (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  tasks_completed integer not null default 0,
  tasks_failed integer not null default 0,
  avg_response_time_ms integer,
  success_rate numeric(5,2) not null default 0,
  last_active_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.record_agent_task(p_agent_id uuid, p_success boolean, p_response_time_ms integer default null)
returns void language plpgsql security definer as $$
declare
  v_owner uuid;
  v_prior_total integer;
begin
  select owner_id into v_owner from public.agents where id = p_agent_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;

  select tasks_completed + tasks_failed into v_prior_total from public.agent_performance_metrics where agent_id = p_agent_id;

  update public.agent_performance_metrics
  set tasks_completed = tasks_completed + case when p_success then 1 else 0 end,
      tasks_failed = tasks_failed + case when p_success then 0 else 1 end,
      avg_response_time_ms = case
        when p_response_time_ms is null then avg_response_time_ms
        when avg_response_time_ms is null then p_response_time_ms
        else round(((avg_response_time_ms * v_prior_total) + p_response_time_ms) / (v_prior_total + 1.0))
      end,
      last_active_at = now(),
      updated_at = now()
  where agent_id = p_agent_id;

  update public.agent_performance_metrics
  set success_rate = round((tasks_completed::numeric / greatest(tasks_completed + tasks_failed, 1)) * 100, 2)
  where agent_id = p_agent_id;
end;
$$;

-- ============================================================
-- New-agent defaults: every agent gets a wallet + a metrics row
-- ============================================================
create or replace function public.handle_new_agent()
returns trigger language plpgsql security definer as $$
begin
  insert into public.agent_wallets (agent_id) values (new.id);
  insert into public.agent_performance_metrics (agent_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists agents_after_insert on public.agents;
create trigger agents_after_insert after insert on public.agents
  for each row execute procedure public.handle_new_agent();

-- ============================================================
-- RLS
-- ============================================================
alter table public.agents enable row level security;
alter table public.agent_credentials enable row level security;
alter table public.agent_ratings enable row level security;
alter table public.agent_wallets enable row level security;
alter table public.agent_transactions enable row level security;
alter table public.agent_performance_metrics enable row level security;

-- Agents: public directory, owner manages
create policy "agents_select" on public.agents for select using (true);
create policy "agents_insert" on public.agents for insert with check (auth.uid() = owner_id);
create policy "agents_update" on public.agents for update using (auth.uid() = owner_id);
create policy "agents_delete" on public.agents for delete using (auth.uid() = owner_id);

-- Credentials: public read, owner manages
create policy "agent_credentials_select" on public.agent_credentials for select using (true);
create policy "agent_credentials_insert" on public.agent_credentials for insert
  with check (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_credentials_update" on public.agent_credentials for update
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_credentials_delete" on public.agent_credentials for delete
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));

-- Ratings: public read, any signed-in non-owner may rate, only the rater can edit/remove their rating
create policy "agent_ratings_select" on public.agent_ratings for select using (true);
create policy "agent_ratings_insert" on public.agent_ratings for insert
  with check (
    auth.uid() = rater_id
    and not exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid())
  );
create policy "agent_ratings_update" on public.agent_ratings for update using (auth.uid() = rater_id);
create policy "agent_ratings_delete" on public.agent_ratings for delete using (auth.uid() = rater_id);

-- Wallets & transactions: financial data, visible only to the owner. Balance only ever changes via the RPC above.
create policy "agent_wallets_select" on public.agent_wallets for select
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));

create policy "agent_transactions_select" on public.agent_transactions for select
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));

-- Performance metrics: public read (trust signal), only mutated via the RPC above
create policy "agent_performance_metrics_select" on public.agent_performance_metrics for select using (true);

-- Realtime for the public directory
alter publication supabase_realtime add table public.agents;

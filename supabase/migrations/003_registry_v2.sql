-- ============================================================
-- Agent Registry v2
-- Categories, verification, trust score, portfolios, activity,
-- follows, and search — the network-effect layer on top of the
-- Agent Identity Layer (001/002).
-- ============================================================

-- ============================================================
-- ADMIN FLAG (needed to gate verification grants)
-- ============================================================
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- 1. CATEGORIES (many-to-many)
-- ============================================================
create table if not exists public.agent_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

insert into public.agent_categories (name, slug) values
  ('Sales', 'sales'),
  ('Marketing', 'marketing'),
  ('Research', 'research'),
  ('Support', 'support'),
  ('Operations', 'operations'),
  ('Development', 'development'),
  ('Finance', 'finance'),
  ('Legal', 'legal'),
  ('Design', 'design'),
  ('Custom', 'custom')
on conflict (name) do nothing;

create table if not exists public.agent_category_links (
  agent_id uuid not null references public.agents(id) on delete cascade,
  category_id uuid not null references public.agent_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, category_id)
);
create index if not exists agent_category_links_category_idx on public.agent_category_links (category_id);

alter table public.agent_categories enable row level security;
alter table public.agent_category_links enable row level security;

create policy "agent_categories_select" on public.agent_categories for select using (true);

create policy "agent_category_links_select" on public.agent_category_links for select using (true);
create policy "agent_category_links_insert" on public.agent_category_links for insert
  with check (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_category_links_delete" on public.agent_category_links for delete
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));

-- ============================================================
-- 2. VERIFICATION SYSTEM
-- ============================================================
-- Level 0 Unverified · 1 Identity Verified · 2 Skill Verified
-- · 3 Performance Verified · 4 Trusted Workforce Agent
create table if not exists public.agent_verifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  level integer not null check (level between 0 and 4),
  verification_type text not null check (verification_type in ('identity', 'skill', 'performance', 'trusted_workforce')),
  verifier_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked', 'expired')),
  issued_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_verifications_agent_id_idx on public.agent_verifications (agent_id);
create index if not exists agent_verifications_status_idx on public.agent_verifications (status);

-- Denormalized, currently-active highest verification level for fast filtering/badges
alter table public.agents add column if not exists verification_level integer not null default 0 check (verification_level between 0 and 4);

create or replace function public.recompute_agent_verification_level()
returns trigger language plpgsql security definer as $$
declare
  v_agent_id uuid := coalesce(new.agent_id, old.agent_id);
begin
  update public.agents
  set verification_level = coalesce((
    select max(level) from public.agent_verifications
    where agent_id = v_agent_id
      and status = 'active'
      and (expires_at is null or expires_at > now())
  ), 0)
  where id = v_agent_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists agent_verifications_after_change on public.agent_verifications;
create trigger agent_verifications_after_change after insert or update or delete on public.agent_verifications
  for each row execute procedure public.recompute_agent_verification_level();

-- Request verification: owner opens a pending request for a level/type
create or replace function public.request_agent_verification(p_agent_id uuid, p_verification_type text, p_level integer)
returns public.agent_verifications
language plpgsql security definer as $$
declare
  v_owner uuid;
  v_row public.agent_verifications;
begin
  select owner_id into v_owner from public.agents where id = p_agent_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;

  insert into public.agent_verifications (agent_id, level, verification_type, status)
  values (p_agent_id, p_level, p_verification_type, 'pending')
  returning * into v_row;

  return v_row;
end;
$$;

-- Grant/approve verification: admin-only
create or replace function public.grant_agent_verification(p_verification_id uuid, p_expires_at timestamptz default null)
returns public.agent_verifications
language plpgsql security definer as $$
declare
  v_row public.agent_verifications;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.agent_verifications
  set status = 'active', verifier_id = auth.uid(), issued_at = now(), expires_at = p_expires_at
  where id = p_verification_id
  returning * into v_row;

  return v_row;
end;
$$;

alter table public.agent_verifications enable row level security;
create policy "agent_verifications_select" on public.agent_verifications for select using (true);
-- All writes go through the security-definer RPCs above; no direct insert/update/delete policies are granted.

-- ============================================================
-- 3. TRUST SCORE ENGINE
-- ============================================================
-- Distinct from reputation_score: a composite of reputation, task
-- success rate, credential quality, account age, verification
-- status, and activity consistency. 0-100 scale.
alter table public.agents add column if not exists trust_score numeric(5,2) not null default 0;

-- Denormalized performance figure kept in sync with agent_performance_metrics,
-- so ranking/sorting at scale never has to join+sort across two tables.
alter table public.agents add column if not exists performance_score numeric(5,2) not null default 0;

-- Incremental, decayable trending signal (see decay_agent_trending_scores below).
alter table public.agents add column if not exists trending_score numeric(10,2) not null default 0;

create or replace function public.compute_agent_trust_score(p_agent_id uuid)
returns numeric language plpgsql security definer as $$
declare
  v_agent public.agents%rowtype;
  v_perf public.agent_performance_metrics%rowtype;
  v_credential_quality numeric := 0;
  v_account_age_days numeric;
  v_account_age_score numeric;
  v_activity_score numeric := 0;
  v_recent_activity_count integer;
  v_reputation_component numeric;
  v_performance_component numeric;
  v_verification_component numeric;
  v_score numeric;
begin
  select * into v_agent from public.agents where id = p_agent_id;
  if not found then
    return 0;
  end if;

  select * into v_perf from public.agent_performance_metrics where agent_id = p_agent_id;

  -- Reputation: 0-5 stars -> 0-100, weighted by how many ratings back it (confidence)
  v_reputation_component := coalesce(v_agent.reputation_score, 0) / 5.0 * 100
    * least(1.0, coalesce(v_agent.rating_count, 0) / 10.0);

  -- Task success rate, already 0-100
  v_performance_component := coalesce(v_perf.success_rate, 0);

  -- Credential quality: verified credentials count more than unverified ones
  select coalesce(sum(case when verified then 2 else 1 end), 0) into v_credential_quality
  from public.agent_credentials where agent_id = p_agent_id;
  v_credential_quality := least(100, v_credential_quality * 10);

  -- Account age: ramps up to a max over the first 180 days
  v_account_age_days := extract(epoch from (now() - v_agent.created_at)) / 86400.0;
  v_account_age_score := least(100, (v_account_age_days / 180.0) * 100);

  -- Verification level: 0-4 -> 0-100
  v_verification_component := (v_agent.verification_level / 4.0) * 100;

  -- Activity consistency: activity events in the last 30 days
  select count(*) into v_recent_activity_count
  from public.agent_activity
  where agent_id = p_agent_id and created_at > now() - interval '30 days';
  v_activity_score := least(100, v_recent_activity_count * 5);

  v_score := (
    v_reputation_component * 0.30 +
    v_performance_component * 0.25 +
    v_credential_quality * 0.15 +
    v_account_age_score * 0.10 +
    v_verification_component * 0.10 +
    v_activity_score * 0.10
  );

  return round(least(100, greatest(0, v_score)), 2);
end;
$$;

create or replace function public.recompute_agent_trust_score(p_agent_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.agents
  set trust_score = public.compute_agent_trust_score(p_agent_id)
  where id = p_agent_id;
end;
$$;

-- Trigger plumbing: any change to a signal that feeds the trust score
-- recomputes it for the affected agent. Kept as small, focused triggers
-- so new signals can be wired in later without touching existing ones.
create or replace function public.trg_recompute_trust_score_agents()
returns trigger language plpgsql security definer as $$
begin
  perform public.recompute_agent_trust_score(new.id);
  return new;
end;
$$;

drop trigger if exists agents_after_upsert_trust on public.agents;
create trigger agents_after_upsert_trust after insert or update of reputation_score, verification_level on public.agents
  for each row execute procedure public.trg_recompute_trust_score_agents();

create or replace function public.trg_recompute_trust_score_by_agent_id()
returns trigger language plpgsql security definer as $$
declare
  v_agent_id uuid := coalesce(new.agent_id, old.agent_id);
begin
  perform public.recompute_agent_trust_score(v_agent_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists agent_credentials_after_change_trust on public.agent_credentials;
create trigger agent_credentials_after_change_trust after insert or update or delete on public.agent_credentials
  for each row execute procedure public.trg_recompute_trust_score_by_agent_id();

-- (agent_activity's own trust-score trigger is created further below, once that table exists)

-- Performance metrics: keep agents.performance_score denormalized + refresh trust score
create or replace function public.trg_sync_performance_score()
returns trigger language plpgsql security definer as $$
begin
  update public.agents set performance_score = new.success_rate where id = new.agent_id;
  perform public.recompute_agent_trust_score(new.agent_id);
  return new;
end;
$$;

drop trigger if exists agent_performance_metrics_after_change on public.agent_performance_metrics;
create trigger agent_performance_metrics_after_change after insert or update on public.agent_performance_metrics
  for each row execute procedure public.trg_sync_performance_score();

-- ============================================================
-- 4. PORTFOLIOS
-- ============================================================
create table if not exists public.agent_projects (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  title text not null,
  description text,
  results text,
  proof_links text[] not null default '{}',
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_projects_agent_id_idx on public.agent_projects (agent_id, created_at desc);

drop trigger if exists agent_projects_updated_at on public.agent_projects;
create trigger agent_projects_updated_at before update on public.agent_projects
  for each row execute procedure public.set_updated_at();

alter table public.agent_projects enable row level security;
create policy "agent_projects_select" on public.agent_projects for select using (true);
create policy "agent_projects_insert" on public.agent_projects for insert
  with check (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_projects_update" on public.agent_projects for update
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));
create policy "agent_projects_delete" on public.agent_projects for delete
  using (exists (select 1 from public.agents where id = agent_id and owner_id = auth.uid()));

-- ============================================================
-- 5. ACTIVITY FEED
-- ============================================================
create table if not exists public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'profile_updated', 'credential_earned', 'verification_earned',
    'rating_received', 'project_added'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_activity_agent_id_idx on public.agent_activity (agent_id, created_at desc);
create index if not exists agent_activity_created_at_idx on public.agent_activity (created_at desc);
create index if not exists agent_activity_type_idx on public.agent_activity (activity_type);

alter table public.agent_activity enable row level security;
create policy "agent_activity_select" on public.agent_activity for select using (true);
-- No direct insert policy: all rows are written by the trigger functions below (security definer).

-- Now that agent_activity exists, wire its own contribution to the trust score.
create trigger agent_activity_after_insert_trust after insert on public.agent_activity
  for each row execute procedure public.trg_recompute_trust_score_by_agent_id();

create or replace function public.log_agent_activity(p_agent_id uuid, p_type text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
begin
  insert into public.agent_activity (agent_id, activity_type, payload) values (p_agent_id, p_type, p_payload);
  update public.agents set trending_score = trending_score + 1 where id = p_agent_id;
end;
$$;

create or replace function public.trg_log_activity_credential()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_agent_activity(new.agent_id, 'credential_earned', jsonb_build_object('title', new.title, 'verified', new.verified));
  return new;
end;
$$;
drop trigger if exists agent_credentials_after_insert_activity on public.agent_credentials;
create trigger agent_credentials_after_insert_activity after insert on public.agent_credentials
  for each row execute procedure public.trg_log_activity_credential();

create or replace function public.trg_log_activity_verification()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'active' and (old.status is null or old.status <> 'active') then
    perform public.log_agent_activity(new.agent_id, 'verification_earned', jsonb_build_object('level', new.level, 'type', new.verification_type));
  end if;
  return new;
end;
$$;
drop trigger if exists agent_verifications_after_change_activity on public.agent_verifications;
create trigger agent_verifications_after_change_activity after insert or update on public.agent_verifications
  for each row execute procedure public.trg_log_activity_verification();

create or replace function public.trg_log_activity_rating()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_agent_activity(new.agent_id, 'rating_received', jsonb_build_object('score', new.score));
  return new;
end;
$$;
drop trigger if exists agent_ratings_after_insert_activity on public.agent_ratings;
create trigger agent_ratings_after_insert_activity after insert on public.agent_ratings
  for each row execute procedure public.trg_log_activity_rating();

create or replace function public.trg_log_activity_project()
returns trigger language plpgsql security definer as $$
begin
  perform public.log_agent_activity(new.agent_id, 'project_added', jsonb_build_object('title', new.title));
  return new;
end;
$$;
drop trigger if exists agent_projects_after_insert_activity on public.agent_projects;
create trigger agent_projects_after_insert_activity after insert on public.agent_projects
  for each row execute procedure public.trg_log_activity_project();

create or replace function public.trg_log_activity_profile_update()
returns trigger language plpgsql security definer as $$
begin
  if new.name is distinct from old.name or new.description is distinct from old.description or new.skills is distinct from old.skills then
    perform public.log_agent_activity(new.id, 'profile_updated', jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;
drop trigger if exists agents_after_update_activity on public.agents;
create trigger agents_after_update_activity after update on public.agents
  for each row execute procedure public.trg_log_activity_profile_update();

-- Trending decays over time so old bursts of activity don't linger forever.
-- Intended to be invoked periodically (e.g. via pg_cron or an external scheduler):
--   select public.decay_agent_trending_scores();
create or replace function public.decay_agent_trending_scores()
returns void language sql security definer as $$
  update public.agents set trending_score = round(trending_score * 0.85, 2) where trending_score > 0.01;
$$;

-- ============================================================
-- 6. FOLLOW SYSTEM (human<->agent, agent<->agent, human<->human)
-- ============================================================
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_type text not null check (follower_type in ('user', 'agent')),
  follower_id uuid not null,
  followee_type text not null check (followee_type in ('user', 'agent')),
  followee_id uuid not null,
  created_at timestamptz not null default now(),
  unique (follower_type, follower_id, followee_type, followee_id),
  check (not (follower_type = followee_type and follower_id = followee_id))
);
create index if not exists follows_follower_idx on public.follows (follower_type, follower_id);
create index if not exists follows_followee_idx on public.follows (followee_type, followee_id);

alter table public.agents add column if not exists followers_count integer not null default 0;
alter table public.agents add column if not exists following_count integer not null default 0;
alter table public.profiles add column if not exists followers_count integer not null default 0;
alter table public.profiles add column if not exists following_count integer not null default 0;

create or replace function public.bump_follow_counts(p_type text, p_id uuid, p_followers_delta integer, p_following_delta integer)
returns void language plpgsql security definer as $$
begin
  if p_type = 'agent' then
    update public.agents
    set followers_count = greatest(0, followers_count + p_followers_delta),
        following_count = greatest(0, following_count + p_following_delta)
    where id = p_id;
  else
    update public.profiles
    set followers_count = greatest(0, followers_count + p_followers_delta),
        following_count = greatest(0, following_count + p_following_delta)
    where id = p_id;
  end if;
end;
$$;

create or replace function public.trg_follows_after_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.bump_follow_counts(new.followee_type, new.followee_id, 1, 0);
  perform public.bump_follow_counts(new.follower_type, new.follower_id, 0, 1);
  -- New followers bump trending directly; they aren't logged as an activity_type
  -- of their own since the spec's activity feed is scoped to profile/credential/
  -- verification/rating/project events.
  if new.followee_type = 'agent' then
    update public.agents set trending_score = trending_score + 2 where id = new.followee_id;
  end if;
  return new;
end;
$$;
drop trigger if exists follows_after_insert on public.follows;
create trigger follows_after_insert after insert on public.follows
  for each row execute procedure public.trg_follows_after_insert();

create or replace function public.trg_follows_after_delete()
returns trigger language plpgsql security definer as $$
begin
  perform public.bump_follow_counts(old.followee_type, old.followee_id, -1, 0);
  perform public.bump_follow_counts(old.follower_type, old.follower_id, 0, -1);
  return old;
end;
$$;
drop trigger if exists follows_after_delete on public.follows;
create trigger follows_after_delete after delete on public.follows
  for each row execute procedure public.trg_follows_after_delete();

alter table public.follows enable row level security;
create policy "follows_select" on public.follows for select using (true);
create policy "follows_insert" on public.follows for insert
  with check (
    follower_type = 'user' and follower_id = auth.uid()
    or (follower_type = 'agent' and exists (select 1 from public.agents where id = follower_id and owner_id = auth.uid()))
  );
create policy "follows_delete" on public.follows for delete
  using (
    follower_type = 'user' and follower_id = auth.uid()
    or (follower_type = 'agent' and exists (select 1 from public.agents where id = follower_id and owner_id = auth.uid()))
  );

-- ============================================================
-- 7. FULL-TEXT SEARCH
-- ============================================================
alter table public.agents add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(skills, ' ')), 'B')
  ) stored;

create index if not exists agents_search_vector_idx on public.agents using gin (search_vector);
create index if not exists agents_skills_idx on public.agents using gin (skills);

create index if not exists agent_credentials_title_idx on public.agent_credentials using gin (to_tsvector('english', title));
create index if not exists profiles_full_name_idx on public.profiles using gin (to_tsvector('english', coalesce(full_name, '')));

-- Ranking-friendly indexes at 1M+ agent scale
create index if not exists agents_reputation_score_idx on public.agents (reputation_score desc);
create index if not exists agents_trust_score_idx on public.agents (trust_score desc);
create index if not exists agents_performance_score_idx on public.agents (performance_score desc);
create index if not exists agents_trending_score_idx on public.agents (trending_score desc);
create index if not exists agents_verification_level_idx on public.agents (verification_level desc);
create index if not exists agents_created_at_idx on public.agents (created_at desc);

-- Single search+filter+sort+paginate entry point. Centralizing this in SQL
-- avoids shipping N+1 queries from the app layer and lets the planner use
-- the indexes above regardless of which filters are active.
create or replace function public.search_agents(
  p_query text default null,
  p_category_slug text default null,
  p_status text default null,
  p_min_reputation numeric default null,
  p_min_verification_level integer default null,
  p_min_performance numeric default null,
  p_sort text default 'top_rated',
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  avatar_url text,
  skills text[],
  status text,
  reputation_score numeric,
  rating_count integer,
  trust_score numeric,
  performance_score numeric,
  trending_score numeric,
  verification_level integer,
  followers_count integer,
  created_at timestamptz,
  total_count bigint
)
language plpgsql stable as $$
declare
  v_offset integer := greatest(0, (p_page - 1) * p_page_size);
  v_tsquery tsquery;
begin
  if p_query is not null and length(trim(p_query)) > 0 then
    v_tsquery := plainto_tsquery('english', p_query);
  end if;

  return query
  with matched as (
    select a.*
    from public.agents a
    where
      (p_status is null or a.status = p_status)
      and (p_min_reputation is null or a.reputation_score >= p_min_reputation)
      and (p_min_verification_level is null or a.verification_level >= p_min_verification_level)
      and (p_min_performance is null or a.performance_score >= p_min_performance)
      and (
        p_category_slug is null or exists (
          select 1 from public.agent_category_links l
          join public.agent_categories c on c.id = l.category_id
          where l.agent_id = a.id and c.slug = p_category_slug
        )
      )
      and (
        v_tsquery is null
        or a.search_vector @@ v_tsquery
        or exists (select 1 from public.profiles p where p.id = a.owner_id and to_tsvector('english', coalesce(p.full_name, '')) @@ v_tsquery)
        or exists (select 1 from public.agent_credentials cr where cr.agent_id = a.id and to_tsvector('english', cr.title) @@ v_tsquery)
      )
  )
  select
    m.id, m.owner_id, m.name, m.description, m.avatar_url, m.skills, m.status,
    m.reputation_score, m.rating_count, m.trust_score, m.performance_score,
    m.trending_score, m.verification_level, m.followers_count, m.created_at,
    count(*) over () as total_count
  from matched m
  order by
    case when p_sort = 'top_rated' then m.reputation_score end desc nulls last,
    case when p_sort = 'newest' then m.created_at end desc nulls last,
    case when p_sort = 'most_active' then m.trending_score end desc nulls last,
    case when p_sort = 'highest_performance' then m.performance_score end desc nulls last,
    case when p_sort = 'trending' then m.trending_score end desc nulls last,
    m.reputation_score desc,
    m.id
  limit p_page_size
  offset v_offset;
end;
$$;

-- ============================================================
-- 8. BACKFILL for agents that existed before this migration
-- ============================================================
update public.agents set trust_score = public.compute_agent_trust_score(id);
update public.agents a set performance_score = coalesce((select success_rate from public.agent_performance_metrics m where m.agent_id = a.id), 0);

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.agent_activity;

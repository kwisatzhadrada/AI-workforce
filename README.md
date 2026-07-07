# AI Workforce — Organization Layer (v3)

Give every AI worker a verifiable, discoverable identity. Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase** (Auth, Postgres).

## Phase 1 — Agent Identity Layer

- 🆔 **Agent ID** — a stable UUID identity, separate from its owner
- 🏷️ **Name & description** — what the agent is and does
- 👤 **Owner** — the human account responsible for the agent
- 🛠️ **Skills** — a tagged list of capabilities
- 📜 **Credentials** — issuer-attributed, optionally-verified credentials
- ⭐ **Reputation** — an aggregate score from peer ratings (1–5 stars), recomputed automatically
- 💰 **Wallet** — an internal credit balance
- 🧾 **Transaction history** — an immutable ledger of every credit/debit
- 📊 **Performance metrics** — tasks completed/failed, success rate, average response time, last active

## Phase 2 — Registry v2 (network effects)

- 🔍 **Global directory** (`/agents`) — full-text search (name, skills, credentials, owner), filters (reputation, status, category, verification, performance), sort (top rated / newest / most active / highest performance / trending), and pagination — all served by a single `search_agents()` SQL function so it scales without N+1 queries.
- 🏷️ **Categories** — Sales, Marketing, Research, Support, Operations, Development, Finance, Legal, Design, Custom. Many-to-many via `agent_category_links`.
- ✅ **Verification framework** — levels 0–4 (Unverified → Identity → Skill → Performance → Trusted Workforce Agent). Owners request verification; admins approve via `/admin/verifications`. The agent's current level is denormalized onto `agents.verification_level` for fast badge rendering and filtering.
- 🧮 **Trust score engine** — a 0–100 composite of reputation, task success rate, credential quality, account age, verification level, and recent activity. Distinct from `reputation_score`. Recomputed automatically by triggers whenever any input signal changes (see `compute_agent_trust_score` in migration 003).
- 🗂️ **Portfolios** (`agent_projects`) — case studies with results and proof links, shown on the agent's profile.
- 📰 **Activity feed** (`agent_activity`) — auto-logged on credential earned, verification earned, rating received, project added, and profile updates. Public, and it feeds both the trust score and the trending signal.
- 🏆 **Rankings** (`/agents/top`) — leaderboards for Top Reputation, Top Trust Score, Top Performance, Top Verified, and Trending, each backed by an indexed column so sorting 1M+ agents doesn't require a join.
- 🔗 **Follow system** — human→agent, agent→agent, and human→human, all through one polymorphic `follows` table with denormalized `followers_count`/`following_count` on both `agents` and `profiles`.
- 🧱 **Hiring schema placeholders** — `organizations`, `jobs`, `applications`, `agent_teams`, `agent_team_members`. Tables + RLS only; no API or UI yet.

## Phase 3 — Organization Layer

Organizations become the platform's primary entity: a company owns an organization, an organization manages agents through departments, and agents perform work — with a lightweight workflow engine to route work between them.

- 🏢 **Organizations** (`/organizations`, `/organizations/[id]`) — expanded with `avatar_url`, `website_url`, `industry`. Creating one auto-provisions the owner's membership, the 7 standard departments, and a metrics row.
- 👥 **Members & role hierarchy** (`organization_members`, `organization_roles`) — Owner (0) → Manager (1) → Supervisor (2) → Agent (3), a table-driven, ordered hierarchy so custom roles can be added later without a schema change. `is_org_manager()` / `is_org_member()` are the single source of truth for authorization checks, used by both RLS policies and RPCs.
- 🗂️ **Departments** (`organization_departments`) — Sales, Marketing, Research, Operations, Support, Finance, Development, plus unlimited custom departments per org.
- 🤖 **Agent assignments** (`agent_assignments`) — an agent, a department, a priority (low/medium/high/critical), a status (active/paused/completed/removed), and a polymorphic `manager_type`/`manager_id` (a human today; the same column pair already supports an *agent* as manager once agent-managing-agent ships — no schema change needed then). A manager can only bring in agents they personally own; any manager can then update or remove the assignment.
- 📊 **Organization metrics** (`organization_metrics`) — total agents, active agents, tasks completed/failed, success rate, trust score, reputation score. Recomputed by `recompute_organization_metrics()`, triggered whenever assignments change or a member agent's trust/performance/reputation score changes.
- 📰 **Activity graph** (`organization_activity`) — member joined/removed, agent joined/removed, department created, verification earned, trust score changed (only logged on moves ≥5 points, to avoid flooding the feed), assignment completed, workflow completed.
- 🔁 **Lightweight workflow engine** (`workflows`, `workflow_steps`, `workflow_runs`, `workflow_step_runs`) — define an ordered chain (e.g. Lead Arrives → Research Agent → Sales Agent → Support Agent), start a run (snapshots every step as pending, activates the first), then advance it step by step through `advance_workflow_run()` — each advance is a handoff, and the run tracks its own status, current step, and completion time. Built and managed from the org dashboard's Workflows tab.
- 📈 **Dashboard** (`/organizations/[id]?tab=...`) — Overview, Departments, Agents, Performance, Workflows, Activity.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations **in order**:
   - `supabase/migrations/001_initial.sql` — auth-linked `profiles` table
   - `supabase/migrations/002_agents.sql` — the Agent Identity Layer (agents, credentials, ratings, wallets, transactions, performance metrics)
   - `supabase/migrations/003_registry_v2.sql` — categories, verification, trust score engine, portfolios, activity feed, follows, full-text search
   - `supabase/migrations/004_hiring_placeholders.sql` — schema-only tables for future hiring features
   - `supabase/migrations/005_organizations.sql` — organization expansion, member/role hierarchy, departments, agent assignments, metrics, activity graph, and the workflow engine

### 3. Configure environment

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, then register your first agent from **Agents → + New Agent**. To act as an admin (approve verifications), set `is_admin = true` on your row in `public.profiles` from the Supabase SQL editor.

## Design notes

- **Search/filter/sort/pagination is one SQL function**, `search_agents()`, rather than app-side query building. At 1M+ agents this keeps planning and indexing in the database's hands and avoids shipping multiple round trips per page load. It's called from both the `/agents` page and `GET /api/agents/search`.
- **Trust score vs. reputation**: reputation is purely peer ratings. Trust score is a weighted composite (30% reputation, 25% performance, 15% credential quality, 10% account age, 10% verification, 10% activity) recomputed by triggers on the relevant tables — see `compute_agent_trust_score` in migration 003. New signals can be added later without touching existing trigger wiring.
- **Trending is incremental + decayable.** Every logged activity event (and every new follower) bumps `agents.trending_score`. `decay_agent_trending_scores()` is provided to be run periodically (e.g. via `pg_cron` or an external scheduler) so old bursts of activity don't linger forever — it isn't scheduled automatically since that requires enabling `pg_cron` on the Supabase project.
- **Verification is a two-step flow**: the owner calls `request_agent_verification` (creates a `pending` row), an admin calls `grant_agent_verification` (marks it `active`, sets the verifier and issue date). Only the highest active, non-expired level is reflected in `agents.verification_level`.
- **Wallet is still an internal ledger, not a real payment rail** (unchanged from Phase 1) — balances only move through the `agent_wallet_transaction` RPC. No payments, crypto, or tokens were added in this phase per scope.
- **Hiring tables are schema-only.** `jobs`, `applications`, `agent_teams` still have no API routes or pages — they're there so the data model doesn't need to change shape when that phase starts. `organizations` graduated from placeholder to a fully built-out primary entity in Phase 3.
- **Visibility**: identity, skills, credentials, reputation, trust score, performance, categories, verification, portfolio, activity, organizations, departments, assignments, and workflows are all public — consistent with the platform's public-professional-network posture. Wallet balance and transaction history remain the one private exception, for both agents and (implicitly) organizations, which have no wallet at all yet.
- **No marketplace, public job posting, payments, or tokens were added in Phase 3**, per scope — organizations manage agents internally; hiring/staffing between organizations is still schema-only (Phase 2's placeholders).

## Project structure

```
app/
  (auth)/login, (auth)/signup   – email/password auth
  auth/callback                 – OAuth/email confirmation code exchange
  api/agents/search              – GET search/filter/sort/paginate endpoint
  (app)/                        – authenticated shell
    agents                      – global directory: search, filters, sort, pagination
    agents/new                  – agent registration
    agents/top                  – rankings / leaderboards
    agent/[id]                  – agent profile: identity, trust score, performance,
                                   credentials, portfolio, wallet (owner), reputation, activity
    agent/[id]/edit             – owner-only: details, categories, verification requests
    admin/verifications         – admin-only: approve pending verification requests
    organizations               – organization directory (search by name, pagination)
    organizations/new           – organization creation
    organizations/[id]          – dashboard: Overview / Departments / Agents / Performance /
                                   Workflows / Activity (via ?tab=)
components/
  nav                           – top nav
  agents                        – directory controls, agent card, badges, follow button,
                                   portfolio, activity feed, category picker, verification panel
  organizations                 – org card, tabs, departments/assignments/performance/activity
                                   panels, workflow builder + run controls
lib/                            – supabase clients, types, agents/registry/organizations data-access helpers
supabase/migrations             – database schema + RLS + RPCs
middleware.ts                   – route protection
```

# AI Workforce — Autonomous Organization Layer (v6)

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
- 📈 **Dashboard** (`/organizations/[id]?tab=...`) — Overview, Departments, Agents, Performance, Tasks, Workflows, Activity.

## Phase 4 — Work Execution Layer

An internal workforce operating system — organizations create, assign, execute, track, and complete work. Not a marketplace, no public job posting, no external clients yet.

- ✅ **Tasks** (`tasks`) — title, description, organization, department, creator, assigned agent, priority, and a six-state lifecycle: Pending → Assigned → In Progress → Review → Completed / Failed. Status auto-advances (assigning an agent to a pending task marks it Assigned) and timestamps auto-instrument themselves (`started_at` on entering In Progress, `completed_at` on reaching a terminal state) — the client can't spoof these.
- ⏱️ **Execution tracking** — `execution_time_seconds` is a generated column (`completed_at - started_at`), never hand-set. `output` (jsonb), `result_summary`, and `attachments` (URLs) capture the deliverable.
- ⭐ **Task reviews → reputation, trust score, org metrics** (`task_reviews`: rating, feedback, quality_score, speed_score). Agent reputation now aggregates both `agent_ratings` (Phase 2, peer ratings) and `task_reviews` (this phase) through one shared function, `recompute_agent_reputation_score()`. Completing a task calls the same performance-metrics path Phase 1's `record_agent_task()` RPC uses (`apply_task_completion_metrics()`), which is what already feeds the agent's trust score (Phase 2) and its organizations' rolled-up metrics (Phase 3) — no new propagation logic needed, just a new entry point into machinery that already existed. Submitting a review while a task is "in review" auto-completes it.
- 📜 **Task history** (`task_history`) — created, assigned, started, completed, reviewed, failed. Fully auto-logged by triggers; there's no direct-write path.
- 🗃️ **Work queue** (`/tasks`) — My Tasks (assigned to an agent you own, or created by you), Organization Tasks, and Department Tasks views, each filterable by status, priority, agent, and department.
- 📊 **Task dashboard** (org dashboard's Tasks tab) — tasks completed/failed, average completion time, top agents, top departments — computed directly from `tasks` scoped to that organization (deliberately *not* reusing Phase 3's `organization_metrics`, since that rollup is agent-global and would misattribute work an agent did for a different org).
- 🔁 **Workflow integration** — `tasks.workflow_run_id` / `workflow_step_id` link a task to the workflow step that spawned it. `start_workflow_run()` now also materializes a task for step 1; `advance_workflow_run_core()` materializes one for whichever step becomes active next. Completing (or failing) a linked task automatically advances the workflow run — the reverse direction didn't exist before this phase.
- 🌐 **API** — `GET/POST /api/tasks` for programmatic queue access and task creation, laying groundwork for external clients without building them yet.
- 🔮 **Future compatibility, not yet built**: external clients, hiring/marketplace (Phase 2's `jobs`/`applications` placeholders are still schema-only), agent-to-agent delegation (`created_by` stays human-only for now — a `delegated_by_agent_id` column can be added later without touching this phase's shape).

## Phase 5 — Agent Runtime Layer

Agents become active workers instead of static records. No marketplace, no payments beyond the existing internal wallet ledger, no public hiring.

- 🛠️ **Capabilities** (`agent_capabilities`) — one row per agent per capability (Research, Writing, Summarization, Lead Generation, Data Analysis, Customer Support, Coding, Planning, or custom), each with its own `input_schema`/`output_schema`, `cost_estimate`, and `enabled` flag. Managed from the agent's edit page.
- ⚙️ **Executions** (`agent_executions`) — agent, task, capability, status (queued → running → completed/failed/cancelled), input/output, `tokens_used`, and `execution_time_ms` (a generated column, same trigger-owned-timestamp pattern as Phase 4's tasks). Runs inline within the request — this stack has no background worker, so "queued" is real but brief.
- 🧠 **Model provider abstraction** (`lib/providers`) — a common `ModelProvider` interface with real implementations for OpenAI (Chat Completions), Anthropic (Messages API), and a local/Ollama-compatible HTTP provider. Agents pick a provider per execution; none are hardcoded. Requires the relevant API key/URL to be configured (see `.env.example`) — without one, that provider fails with a clear `ProviderConfigError` rather than fabricating output.
- ⚖️ **Decision engine** — four rules-based, fully-audited decision functions: `decide_agent_accept_task` (capacity, capability, wallet balance), `decide_agent_complete_task` (did the execution actually produce output), `decide_request_assistance` (low trust score or a recent failure streak), `decide_delegate_task` (agent inactive, at capacity, or trust too low). Every call — accepted or not — writes a row to `agent_decisions`; a task an agent declines still gets a `failed` execution row explaining why, so rejections are as auditable as successes.
- 📚 **Memory** (`agent_memory`) — facts, preferences, learned patterns, and org context, keyed `(agent_id, memory_type, key)` so writes upsert instead of accumulating duplicates. `search_agent_memory()` does keyword retrieval (full-text search) ranked by relevance × importance × recency. Private to the agent's owner.
- 📡 **Communication** (`agent_messages`) — agent → agent, agent → organization, agent → manager, with a `receiver_type`/`receiver_id` pair mirroring the `follows` polymorphism from Phase 2. Surfaced at `/messages` for the humans on the receiving end.
- 🔀 **Delegation** (`delegations`) — agent A proposes handing a task to agent B, with a reason; B's owner accepts or rejects. Acceptance reassigns the task, cascading through Phase 4's existing tasks triggers (history, workflow advance) rather than duplicating that logic.
- 📈 **Execution dashboard** (`/executions`) — My Agents / Organization views; active executions, failed executions, success rate, average runtime, and agent utilization (share of in-scope agents currently running something).
- 🔍 **Observability** — `agent_executions` is the execution log, `agent_error_logs` is a dedicated error log (auto-populated whenever an execution fails), and `agent_decisions` is the decision log — together with Phases 2-4's activity/history tables, every runtime action is auditable somewhere.
- 🔒 **Security hardening** — closed a gap that applied retroactively to Phases 2-4: several `security definer` helper functions (`apply_task_completion_metrics`, `create_task_for_workflow_step`, `advance_workflow_run_core`, the various `log_*`/`recompute_*` functions, and this phase's `apply_execution_cost`) had no internal ownership check and were directly callable by any authenticated user via `supabase.rpc()`, since Postgres grants `EXECUTE` to `PUBLIC` by default. Migration 007 revokes that grant from `public`/`anon`/`authenticated` on every such function; they keep working from inside other security-definer triggers (which run as their owner regardless of grants) but are no longer directly reachable.

## Phase 6 — Autonomous Organization Layer

Organizations operate from goals, not tasks: goal → plan → tasks, driven by a manager agent whose every action is logged, with humans able to approve, reject, pause, or modify at every step.

- 🎯 **Goals** (`organization_goals`) — title, description, priority, status (Draft → Active → Completed/Failed), `target_metrics` (jsonb), deadline, and a `manager_agent_id` — the agent that autonomously drives this goal. `is_paused` is a separate flag from `status` (matching the spec's exact 4-state enum) so a goal can be "Active" yet on hold.
- 🗺️ **Planning engine** (`goal_plans` → `goal_plan_steps` → `goal_plan_step_dependencies`) — a goal can have multiple plans (draft/approved/rejected/completed); each plan is an ordered set of steps with an explicit dependency graph (not assumed-linear — a step can wait on more than one predecessor), a department, and an estimated effort. Plans can be authored manually or **drafted by the LLM** (reusing Phase 5's provider abstraction: `generateGoalPlan()` asks the model for strict JSON, parses it, and inserts it as a review-only draft) — either way, nothing runs until a human approves it.
- ⚙️ **Task generation** — approving a plan (`approve_goal_plan`) immediately materializes tasks for every step with no unmet dependencies, via the same `tasks` table Phase 4 built (`tasks.goal_plan_step_id` links them back). As linked tasks complete or fail, a reactive trigger advances the plan automatically — completing one step's task can make the next step's task get created and assigned without another click.
- 🤖 **Autonomous manager agent** — `run_goal_manager_cycle()` is the manager agent's operating loop: create tasks for ready steps, assign the best available agent (ranked by trust score and utilization, gated by the same `decide_agent_accept_task` check Phase 5 built), monitor plan/goal completion, and escalate failed steps as an `agent_message` alert to the organization. It runs reactively (whenever a linked task completes/fails) and can also be re-triggered manually from the goal page. Every single action — accepted or declined — is written to `agent_decisions` via one shared `log_decision()` function, now carrying explicit `inputs`/`outputs` columns in addition to Phase 5's `reasoning`/`outcome`.
- 📊 **Organization state** (`organization_state`) — active goals, blocked (paused) goals, resource utilization (active tasks vs. theoretical agent capacity), agent utilization (share of assigned agents currently working), and a composite risk score (overdue goals, recent task failure rate, average assigned-agent trust). Recomputed on every goal or task-status change.
- ⏱️ **Agent utilization** (`agent_utilization` + `get_agent_utilization()`) — deliberately lean: only cumulative active time is stored here; task volume and success rate already live on Phase 1's `agent_performance_metrics` and idle time is derived live from `last_active_at` rather than stored (it grows continuously and would go stale). The manager agent's assignment logic reads this when ranking candidates.
- 🕹️ **Human override** — approve/reject a plan (manager-only RPCs), pause/resume a goal, edit a goal's title/description/priority/manager agent, or mark it failed outright — all exposed on `/goals/[id]`.
- 📋 **Dashboard** (`/goals`) — organization picker, `organization_state` summary, goal cards with status/priority/deadline; `/goals/[id]` for plan visualization (steps, dependencies, status, linked tasks), progress, and the manager agent's full decision log.
- 🔮 **Success metrics stay honest**: target metrics are shown as declared, and plan-step completion is shown as a progress proxy — this phase does not fabricate a "% of 100 leads generated" number, since nothing here yet reads business outcomes back out of task output. That would be a real, separate integration, not something to fake.

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
   - `supabase/migrations/006_tasks.sql` — tasks, task history, task reviews, and the workflow↔task integration
   - `supabase/migrations/007_agent_runtime.sql` — capabilities, executions, decision engine, memory, communication, delegation, and a security-hardening pass on earlier phases' internal functions
   - `supabase/migrations/008_goals.sql` — goals, planning engine, task generation, the autonomous manager agent framework, organization state, agent utilization, and a further security-hardening pass

### 3. Configure environment

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

To actually run agent executions (Phase 5), also set at least one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `LOCAL_MODEL_URL`/`LOCAL_MODEL_NAME` — see `.env.example`. Everything else works without any of these configured; only `POST /api/executions` needs a provider.

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
- **Task completion timestamps are trigger-owned, not client-owned.** `started_at`/`completed_at` are set by a `BEFORE INSERT OR UPDATE` trigger the moment status crosses into `in_progress` / a terminal state; `execution_time_seconds` is a `GENERATED ALWAYS AS` column derived from them. A client can report output, but it can't fake how long work took.
- **Two independent completion paths, one shared core.** A task reaches `completed` either directly (an executor sets the status) or via a review submitted while `status = 'review'` (which flips it to `completed`). Both paths funnel through the same `tasks_after_update_metrics` / `tasks_after_update_history` / `tasks_after_update_advance_workflow` triggers, so there's exactly one place performance metrics, history, and workflow advancement are wired up.
- **Workflow-triggered task creation reuses task RLS, not a bypass.** `create_task_for_workflow_step()` is `security definer` (system-driven, no acting user to check), but the resulting rows are ordinary tasks — visible and actionable under the same policies as any manually-created task.
- **No marketplace, public job posting, payments, or agent-to-agent delegation were added in Phase 4**, per scope. `tasks.created_by` is human-only for now; delegation later just needs an additional nullable column, not a redesign.
- **The runtime has no background worker.** `POST /api/executions` runs the whole decision → provider call → completion pipeline inline within the request. That's honest for this stack (Next.js on Supabase, no queue infrastructure) and fine for interactive use; a real job queue would be the next step before running executions unattended at volume.
- **Decision engine is rules-based, not LLM-based.** `decide_agent_accept_task` / `decide_agent_complete_task` / `decide_request_assistance` / `decide_delegate_task` are deterministic SQL functions (capacity, capability match, wallet balance, trust score, recent failure rate) rather than a model call asked to "decide." That keeps every decision explainable and free, and it's a legitimate policy layer — an LLM-based version could sit in front of it later without changing the audit trail shape.
- **Execution cost is a flat per-capability estimate, debited on completion** via `agent_wallet_transaction` (Phase 1's owner-authorized RPC — the runtime always executes as the agent's owner, since that's who Phase 1's `agent_executions` RLS requires to trigger a run). It is not derived from actual token usage; wiring in provider-specific per-token pricing is a natural follow-up.
- **No marketplace, payments beyond the existing wallet, or public hiring were added in Phase 5**, per scope.
- **Planning is LLM-drafted, not LLM-executed.** `generateGoalPlan()` is the only place in Phase 6 that calls a model, and its only output is a `draft` plan row — the manager agent's actual operating loop (`run_goal_manager_cycle`) is deterministic SQL, same as Phase 5's decision engine. A human still has to approve before anything is created or assigned.
- **The manager cycle is both reactive and on-demand**, deliberately mirroring Phase 4's workflow-advance pattern: a trigger re-runs it automatically whenever a plan-linked task completes or fails (wrapped so a cycle error never blocks the task's own update), and a "Run Manager Cycle" button calls the same function on demand for a manual nudge — there's still no background worker in this stack.
- **A goal's manager agent is required, not optional, for autonomy.** You can create a goal and even a plan without one, but `run_goal_manager_cycle`/`approve_goal_plan` raise a clear error if no `manager_agent_id` is set — the spec frames this as *an agent's* behavior, so the schema doesn't let the cycle run without one attributed.
- **`agent_utilization` avoids duplicating Phase 1/4 data.** Task volume and success rate already live on `agent_performance_metrics`; this table adds only the new cumulative-active-time signal, and idle time is computed live from `last_active_at` at read time rather than stored (a stored idle counter would grow stale between writes).
- **No marketplace, public hiring, or new payment mechanisms were added in Phase 6**, per scope — the manager agent's wallet interactions are unchanged from Phase 5.

## Project structure

```
app/
  (auth)/login, (auth)/signup   – email/password auth
  auth/callback                 – OAuth/email confirmation code exchange
  api/agents/search              – GET search/filter/sort/paginate endpoint
  api/tasks                     – GET (list, filtered) / POST (create) task API
  api/executions                – GET (list, filtered) / POST (run) execution API
  api/goals/[id]/plan           – POST: draft a plan for a goal via the LLM provider
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
                                   Tasks / Workflows / Activity (via ?tab=)
    tasks                       – work queue: My Tasks / Organization Tasks / Department Tasks,
                                   filtered by status/priority/agent/department
    tasks/new                   – task creation
    tasks/[id]                  – task detail: execution, output, review, history,
                                   runtime execution trigger, delegation
    executions                  – dashboard: My Agents / Organization views, utilization metrics
    executions/[id]             – execution detail: input/output, decision log, error logs
    messages                    – inbox for agent → manager / agent → organization messages
    goals                       – dashboard: organization picker, organization_state summary,
                                   goal cards
    goals/new                   – goal creation
    goals/[id]                  – goal detail: human override, plan creation (manual + AI),
                                   plan/step/dependency visualization, manager decision log
components/
  nav                           – top nav
  agents                        – directory controls, agent card, badges, follow button,
                                   portfolio, activity feed, category picker, verification panel,
                                   capabilities panel, memory panel
  organizations                 – org card, tabs, departments/assignments/performance/activity/
                                   task-dashboard panels, workflow builder + run controls
  tasks                         – task card, queue controls, execution actions, review form,
                                   history timeline, agent assignment control, runtime execution
                                   panel, delegation panel, execution row/view controls
  messages                      – message row (inbox item, mark-as-read)
  goals                         – goal card, queue controls, org-state panel, override controls,
                                   plan card, plan step builder, AI plan generation controls,
                                   decision log panel
lib/
  providers                     – ModelProvider abstraction: OpenAI, Anthropic, local/Ollama
  runtime                       – execution orchestration (decision engine -> provider -> tracking),
                                   AI plan generation
  supabase, types, agents/registry/organizations/tasks/agentRuntime/goals data-access helpers
supabase/migrations             – database schema + RLS + RPCs
middleware.ts                   – route protection
```

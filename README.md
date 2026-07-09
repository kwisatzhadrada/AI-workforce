# AI Workforce — B2B Sales Vertical: Real Integrations (v10, Stabilization Sprint 1, Campaign Experience Sprint, Customer Validation Sprint)

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

## Phase 7 — Workforce Templates

The platform stops being infrastructure and starts being deployable AI businesses: pick "B2B Sales Team," click deploy, and a fully-staffed organization exists — departments, agents with capabilities, a workflow, and goals — in one call.

- 📦 **Templates** (`workforce_templates`) — name, description, industry, a one-line `goal`, and a free-form `configuration` bag. Five real, fully-fleshed system templates ship in migration 010: **B2B Sales Team**, **Customer Support Team**, **Research Team**, **Content Marketing Team**, **Recruiting Team** — not placeholder rows, each with real agents, a real workflow, and real goals.
- 🧩 **Agent blueprints** (`agent_blueprints`) — name, description, a default system prompt, a `capabilities` array (name/description/cost estimate/schemas — deployed straight into Phase 5's `agent_capabilities`), `memory_defaults` (seeded into Phase 5's `agent_memory` on deploy), a `workflow_role` label, a target `department_slug`, and an `is_manager` flag marking which blueprint becomes a deployed goal's manager agent.
- 🔁 **Workflow blueprints** (`workflow_blueprints` → `workflow_blueprint_steps`) — an ordered chain, each step optionally tied to a specific agent blueprint or just a department. The B2B Sales Team's is exactly the spec's example: Research Prospect → Qualify Prospect → Outreach → Follow-up.
- 🎯 **Goal blueprints** (`goal_blueprints`) — title, description, priority, target metrics, and which agent blueprint manages it. Covers all four named examples (Generate Leads, Close Deals, Answer Support Tickets, Create Content) plus two more (research, recruiting) that don't force-fit the named list.
- 🚀 **Deployment engine** (`deploy_workforce_template()`) — one function, one transaction: creates the organization (Phase 3's trigger seeds membership + standard departments for free), then agents + capabilities + memory + department assignments, then workflows + steps, then goals — wiring blueprint cross-references (which agent fills which workflow step, which agent manages which goal) via an in-memory blueprint-id → deployed-id map. It is **not** `security definer`: the new org is owned by the deploying user, so every write is something an org owner is already allowed to do to their own org under existing RLS — no elevated trust required for something this consequential. Any failure rolls back the entire deployment; nothing half-built is left behind.
- 🧬 **Lineage tracking** — deployed `agent_assignments`, `workflows`, and `organization_goals` carry a `source_*_blueprint_id` back to the blueprint that created them, which is what makes the goal-completion metric possible.
- 📊 **Metrics** (`get_template_metrics()`) — Template Usage (`usage_count`, bumped on every deploy), Deployment Success (from `template_deployments`), Goal Completion Rate (completed vs. total goals traced back to that template's `goal_blueprints`). Deliberately `security definer`: these are meant to be public aggregate stats, not silently scoped down by whatever deployments/goals the browsing user's own RLS happens to make visible to them.
- 🖥️ **Dashboard** (`/templates`) — browse with live metrics; `/templates/[id]` previews the full structure (every agent with its capabilities, the workflow chain, every goal with its target metrics and manager) before you commit, then deploys with one form.

## Phase 8 — Simulation, Validation & Autonomy Scoring

Validates the network under real operating conditions rather than adding new platform surface: a simulation engine seeds real organizations, agents, goals, and workflows through the *actual* deployment/planning/execution machinery built in Phases 3-7, drives every task to resolution, then measures what actually happened. No mock business data is fabricated — simulated executions are clearly marked (`output->>'simulated'`) and their outcomes are decided by a real probability model derived from each agent's real trust score, not a coin flip independent of the system's own state.

- 🧪 **Simulation engine** (`simulation_runs`, `simulation_events`, `simulation_metrics`) — `start_simulation_run()` deploys real organizations by cycling through the five Phase 7 templates via `deploy_workforce_template()`, activates every workflow (`start_workflow_run()`) and goal (a synthetic single-step plan + `approve_goal_plan()`) the templates leave planless/unstarted by design, tops up agents/goals/workflows/tasks to exact targets when the templates don't multiply out evenly, then resolves every open task through `simulate_task_resolution()` — occasionally simulating a delegation — until the task target is hit or the iteration cap is reached. Every organization/agent/goal/workflow/task the run touches is logged to `simulation_events`; `simulation_runs.organization_ids` scopes "this run's world" without adding a tagging column to any core table.
- 🎲 **Trust-weighted task resolution** — `simulate_task_resolution()` assigns an unassigned task to a real active agent in its organization, then resolves it via a success probability derived from that agent's actual `trust_score` (`0.5 + (trust_score - 50) / 150`, clamped to [0.4, 0.95]) — a brand-new agent (trust 0) genuinely starts at a pessimistic 40%, same as it would need to for real. It runs through the real `agent_executions` lifecycle and the real `decide_agent_accept_task` / `decide_agent_complete_task` checks, so completions and failures propagate through the exact same reputation/trust/metrics cascades a human-run task would.
- 📊 **Organization stress metrics** (`compute_run_metrics()`) — per run: task completion rate, task failure rate, workflow completion rate, delegation frequency, average agent utilization, manager decision quality (share of `agent_decisions` with a positive outcome), goal completion rate — stored as rows in `simulation_metrics` rather than one wide table, so new metrics can be added later without a schema change.
- 🔎 **Bottleneck analysis** (admin-only, platform-wide) — `find_overloaded_agents()` (3+ concurrent tasks), `find_idle_agents()` (active but untouched for 7+ days), `find_workflow_deadlocks()` (current step stalled 1+ hour), `find_stuck_goals()` (active-but-paused or no step progress in 24h), `find_task_assignment_failures()` (unassigned 1+ hour), `find_trust_score_anomalies()` (3+ recent execution failures despite a trust score above 60 — a lagging trust score that hasn't caught up to current behavior yet).
- 🩺 **Network health dashboard** (`/system-health`, admin-only) — Active Organizations, Active Agents, Task Throughput (24h), Goal Completion Rate, Average Runtime, Failure Rate, all computed live and platform-wide by `get_network_health()`.
- 🧮 **Autonomy score** (`compute_autonomy_score()`) — 0-100 composite of four honestly-scoped proxies: % tasks auto-created (linked to a workflow step or goal plan step), % completed tasks with a linked successful execution, % goals achieved without intervention (an exact measure here, not a proxy — goals can *only* reach `completed` via the autonomous `monitor_goal_progress()` path; there is no "mark complete" button anywhere in the UI), % completed workflow runs whose every task was completed via a linked successful execution.
- 📰 **Executive reporting** (`system_reports`, `generate_system_report('daily' | 'weekly')`) — Top Organizations (by success rate), Top Agents (by trust score), Problem Areas (the six bottleneck counts), and Optimization Opportunities (plain-language suggestions derived directly from which bottleneck counts are non-zero — no LLM call, so it's free and fully deterministic).
- 🖥️ **`/system-health`** — admin-gated the same way `/admin/verifications` is: network health cards, autonomy score, simulation run history, the six bottleneck lists, a "Run Simulation" button, and report generation/viewing.

## Phase 9 — Workforce Intelligence Layer

The network learns from its own operation: every table here is derived entirely from data Phases 1-8 already produce — no new business-transaction concepts (no marketplace, payments, crypto, hiring, external clients, or new organization systems), and every recommendation requires explicit human approval before anything is applied.

- 🧠 **Agent intelligence** (`agent_profiles_intelligence`) — recomputed reactively whenever one of an agent's tasks completes or fails: **strengths**/**weaknesses** (per-department success rate, grouped by department *id* rather than name since every organization seeds the same standard department names), **specializations** (departments at ≥70% success over 3+ tasks), **risk factors** (low trust, current overload, a recent failure streak, a declining trend), **growth trend** (last-30-days vs. the 30 days before that, `improving`/`declining`/`stable`, or `insufficient_data` below a 5-sample floor in either window), **goal contribution** (completed tasks spawned by a goal plan step), **workflow performance** (success rate restricted to workflow-spawned tasks), and **delegation effectiveness** (completion rate of tasks this agent received via an accepted delegation).
- 💼 **Agent career system** (`agent_careers`) — first/last task, and three capped (≤100 entries) history arrays written by one shared `record_agent_career_event()` function: `organization_history` (joined/left, hooked into the existing agent-assignment triggers), `promotion_history` (became a goal's manager agent, or an assignment priority increase — both real, already-tracked signals, not new concepts), and `performance_history` (a throttled daily trust/success/career-score snapshot). **Career score** is a weighted composite (30% trust, 30% success rate, 20% tenure capped at 180 days, up to 20% from promotion count, ±5 for growth trend).
- 🏢 **Organization intelligence** (`organization_health`) — goal completion rate, workflow completion rate, agent utilization (reused directly from Phase 6's `organization_state`, not recomputed), task throughput (24h), failure rate, and an org-scoped `compute_org_autonomy_score()` (the same four proxies as Phase 8's platform-wide `compute_autonomy_score()`, restricted to one organization) rolled into a single **health score**. Public, same visibility precedent as `organization_metrics` (Phase 3) — an aggregate performance rollup, not the internal risk/planning state `organization_state` already keeps member-only.
- 🔁 **Workflow intelligence** (`get_workflow_intelligence()`) — success rate, average duration, **failure points** (which step order fails most, by name), and average handoff latency (the gap between one step's completion and the next step's start) — computed live from `workflow_runs`/`workflow_step_runs`, no new table.
- 🔮 **Prediction engine** (`workforce_predictions`) — `predict_task_success` (trust-weighted, same formula as Phase 8's simulation, but for real tasks), `predict_goal_success` (plan step-completion ratio, adjusted down by organization risk and an overdue deadline), `predict_workflow_failure` (blends historical run failure rate with the average trust of the workflow's staffed agents), `predict_agent_burnout` (concurrent load, recent failures, cumulative active time, low trust), and `predict_organization_risk` (deliberately just *logs* Phase 6's existing `compute_organization_risk_score()` as a tracked-over-time prediction rather than re-deriving organization risk from scratch). Each function is gated to the entity's own organization's manager/supervisor (or admin) — resolved per entity type, not a blanket admin-only gate, since day-to-day org operators are exactly who'd want to refresh their own predictions.
- 💡 **Recommendation engine** (`workforce_recommendations`) — `generate_recommendations_for_organization()` produces four kinds, each with a `reason`, `expected_impact`, and `confidence_score`: **reassign_agent** ("Move X to Y Department" when an agent's specialization doesn't match its current assignment), **add_agent** (a department with 3x+ open tasks per active agent), **replace_workflow_step** (a step failing 40%+ of a workflow's runs, given 3+ runs to be statistically meaningful), and **rebalance_load** (an agent with 3+ concurrent tasks in that org — computed inline rather than by calling Phase 8's platform-wide, unconditionally-admin-gated `find_overloaded_agents()`, since this function is also callable by an org supervisor who isn't authorized to call that admin-only finder). A partial unique index keeps at most one *pending* recommendation per exact type+entity, so re-running the generator doesn't pile up duplicates.
- 🕹️ **Self-optimization, human-approval-required** — a manager agent can "consume" a recommendation via `agent_review_recommendation()` (logged to `agent_decisions` as a new `review_recommendation` decision type — Phase 5/6's existing decision log, not a new one), but this **never** changes the recommendation's status. Only a human calling `approve_recommendation()` / `reject_recommendation()` can do that, and only an *approved* recommendation can be `apply_recommendation()`-ed — which executes the concrete, mechanical part (a department reassignment, a task handoff, a workflow step's agent) for three of the four types; `add_agent` deliberately stays advisory-only, since spinning up a whole new staffed agent is a resourcing decision, not a field update.
- 🏆 **Benchmarking** — `rank_agents`/`rank_organizations`/`rank_templates`/`find_best_workflows`/`find_worst_workflows` and `compare_agents`/`compare_organizations`/`compare_workflows` (head-to-head, two entities at a time). Public, same visibility posture as Phase 2's `/agents/top` rankings — these aggregate already-public data, not the operational `workforce_predictions`/`workforce_recommendations` tables.
- 🚨 **Anomaly detection** — three new finders (`find_unusual_failures`: an agent's 24h failure rate spiking 30+ points above its own historical baseline; `find_delegation_loops`: 3+ delegation records on the same task; `find_underperforming_organizations`: health score 20+ points below the platform average) combined with Phase 8's three existing finders (`find_trust_score_anomalies`, `find_workflow_deadlocks`, and the rest) into one `detect_anomalies()` aggregator — extended, not re-derived.
- 📰 **Executive insights** — Phase 8's `generate_system_report()` is redefined (same table, same signature) to accept `monthly` alongside `daily`/`weekly`, and to add four intelligence-driven content keys — **Top Performers** (`rank_agents`), **Biggest Risks** (the latest burnout/organization-risk prediction per entity), **Growth Opportunities** (agents with an `improving` trend), **Optimization Suggestions** (pending recommendations ranked by confidence) — alongside Phase 8's existing network-health/autonomy-score/problem-areas content, which is untouched.
- 🖥️ **`/intelligence`** — admin-gated: Agents, Organizations, Workflows, Predictions, Recommendations, Anomalies, and Reports tabs. Recommendations show live Approve/Reject/Apply controls; Predictions and Recommendations both have an organization-scoped "refresh" trigger (no cron in this stack — same manual-button pattern every prior phase uses).

## Phase 10 — B2B Sales Vertical: Real Integrations

Not a new platform layer — this phase makes the existing B2B Sales Team workforce template (Phase 7) produce real business outcomes, by wiring three of its four agents to real external systems instead of a bare LLM call. No new agent, workflow, or intelligence system was introduced; everything routes through the task/workflow/execution machinery Phases 1-9 already built.

- 🔌 **Integrations** (`organization_integrations`) — one row per organization per connected provider, restricted to that organization's managers (credential storage, not public profile data — a deliberate exception to the platform's usual public-professional-network visibility). **Gmail** connects via a real OAuth2 flow (`/api/integrations/gmail/connect` → Google's consent screen → `/api/integrations/gmail/callback`, requiring `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env`). **HubSpot** and **Hunter.io** connect by pasting a Private App access token / API key — the simpler, equally real integration path both providers actually recommend for a single-account custom integration, with no OAuth consent screen to register.
- 🔎 **Lead Research Agent** — its capability is now tagged `integration_action = 'prospect_enrich'`. Given target company domains (parsed from the task's title/description), it calls Hunter.io's real Domain Search API and returns real people — name, email, title — at each domain. Company *discovery* from a target-market description (as opposed to enrichment of a domain you already have) needs a paid firmographic API (Apollo, Clearbit Discovery); the `ProspectProvider` interface is built so one drops in behind the same capability later without touching the agent or workflow.
- 📤 **Outreach Agent** — tagged `email_draft_send`. For every real lead the research step found (read from that step's `tasks.output`, the existing "deliverable" column, not a new data-passing system), it drafts a personalized email with the existing LLM provider abstraction (Phase 5) and actually sends it through the connected Gmail account. Reply detection is on-demand (`checkRepliesForOrganization` / the "Check Replies" button) — Gmail threads are checked for a message after the one sent, matching the "no background worker" pattern every prior phase uses for anything that would otherwise need a poller.
- 🗂️ **CRM Agent** (formerly "Follow-up Agent" — renamed rather than added as a fifth blueprint, since "keep the CRM current and track responses" was already this role's job) — tagged `crm_upsert`. Creates or updates a real HubSpot contact for every prospect the run touched and logs a real note referencing the actual email sent.
- 📊 **Measurement** (`sales_activities`) — a plain, append-only event ledger for **Leads Found**, **Emails Sent**, **Replies Received**, and **Meetings Booked** — the same shape as the existing `task_history`/`organization_activity` logs, not a new "intelligence" concept. `get_sales_metrics()` is literal counting over real rows, not a derived score. Meeting booking has no calendar integration yet, so it's a manual "Log a Booked Meeting" action — an honest human-confirmed data point rather than an over-claimed automated one.
- 🖥️ **Three new tabs on the existing organization dashboard** — Integrations (connect/disconnect, status), Sales Pipeline (the four metrics, reply rate, activity feed, Check Replies, Log a Booked Meeting), and Setup Wizard (a read-only checklist over existing state — which integrations are connected, whether a lead-gen plan is approved, whether any task has run — linking to the Integrations/Goals/Tasks tabs rather than reimplementing any of them). No new page hierarchy; all three reuse `OrgTabs`, the same tab pattern every prior phase's dashboard additions used.
- 📘 **`DEPLOYMENT_GUIDE.md`** — the real steps to run this against live accounts: a Supabase project, a deployed host with a public URL, a Google Cloud OAuth consent screen (in "Testing" mode — the sensitive `gmail.send` scope otherwise needs a verification review that can take weeks), a HubSpot Private App token, and a Hunter.io API key.
- 🔬 **Validated end to end** — real template deployment, real RLS/RPC authorization checks, and the real `GmailEmailProvider`/`HunterProspectProvider`/`HubSpotCrmProvider` classes called against their live endpoints with deliberately invalid credentials, confirming the request shapes are correct (Gmail; Hunter.io/HubSpot were blocked by this validation session's own sandboxed network policy, not by the code). That pass found two real, pre-existing bugs that Phase 10's real-world side effects newly make consequential: nothing stops a duplicate "Run Execution" click from sending the same real email twice, and the goal-driven auto-assignment (Phase 6) can staff the wrong agent onto a step when every agent ties at trust score 0. Neither is fixed here — this pass was validation and documentation, not new development — see the full validation report for root causes and recommended fixes.

## Stabilization Sprint 1

Not a new phase — no new agent, workflow, intelligence, or business-model concept was introduced. This sprint exists to fix the two real bugs Phase 10's validation pass found and left open, then verify the fix against a real Postgres role rather than just the code. See `RELIABILITY_REPORT.md` for the full Critical/High/Medium/Low breakdown and `VALIDATION_CHECKLIST.md` for the pre-flight checklist before pointing this at real Gmail/HubSpot/Hunter accounts.

- 🔒 **Duplicate real-world side effects are now impossible, not just discouraged.** `agent_executions` gained an `integration_action` column and a partial unique index on `(task_id, integration_action)` covering `queued`/`running`/`completed` — Postgres itself rejects a second attempt at the same real-world action on the same task, atomically, even under concurrent requests. A genuinely `failed` attempt is deliberately excluded, so transient failures stay retryable. HubSpot's own native 409-conflict-on-duplicate-email is now also caught and recovered (reuses the existing contact) as a second, independent layer.
- 🎯 **Assignment accuracy — two bugs, not one.** The fragile `ILIKE` substring/first-word capability matcher is replaced with `capability_matches_task()`, a whole-word-overlap matcher, plus a two-pass assignment loop (require a real match first, only fall back if truly nobody matches). Fixing that exposed a second, deeper bug the old matcher had been silently hiding: every fresh agent's wallet starts at $0, and once a real capability match started flowing into the accept-task decision, its wallet-balance check began rejecting the *correctly* matched agent in favor of a wrong-but-affordable one. Assignment no longer passes a capability into that billing check — billing still happens, correctly, at execution time, where it always worked.
- 🔍 **A third, more severe bug was found in the process of testing the above for real**: `deploy_workforce_template()` was never marked `security definer`, meaning every real "Deploy Template" click — for any template, since Phase 9 — failed outright for an actual signed-in user with `permission denied for function increment_template_usage`. Every prior phase's local testing had silently masked this behind a blanket `grant execute on all functions` step that real Supabase never performs. Fixed by making the function `security definer` (no new privilege — every write inside was already scoped to the real caller's `auth.uid()`).
- 📟 **New `/diagnostics` page** (admin-only, same gating pattern as `/system-health`) — execution history, integration connect/disconnect/error history, recent failures, retries (tasks with more than one execution row — no new "retry count" concept), and assignment decisions (now with real reasoning: which capability matched, or why it fell back). Backed by five new `security definer` + `is_admin()`-gated RPCs, reusing `agent_executions`/`agent_decisions`/`organization_activity` exactly as they already existed — no new tables.
- 📗 **`VALIDATION_CHECKLIST.md`** — pre-flight checklist for pointing this at real Gmail/HubSpot/Hunter.io accounts, including the exact SQL to confirm each fix landed and an explicit warning against the blanket-grant testing shortcut that hid two of this sprint's three findings.
- 📕 **`RELIABILITY_REPORT.md`** — Critical/High/Medium/Low risk breakdown with mitigation status for every finding this sprint, plus the carried-over open items from Phase 10 (workflow-path task descriptions, credential encryption at rest, no background worker) that remain documented, not fixed, by explicit scope decision.
- 🧪 **Verified the same way as every phase since 8** — every migration applied in order against a real local Postgres 16 instance, `SET ROLE authenticated` exercised as both a genuine org owner and an unrelated outsider in both directions, and this time specifically *without* the blanket-grant shortcut, which is what surfaced the `deploy_workforce_template` and wallet-balance bugs in the first place.

## Campaign Experience Sprint

Not a new phase, no new platform layer — this sprint makes the B2B Sales
Workforce usable by a non-technical business owner end to end: create an
organization, deploy the workforce, connect integrations, launch a
campaign, review before anything sends, and see business outcomes —
without touching SQL or picking a capability from a dropdown. See
`BLOCKERS.md` for what's still genuinely open, ranked by severity.

- 🧭 **`/onboarding`** — a single guided page from account to running
  campaign: (1) name your business, one click deploys a full B2B Sales
  Team workforce (`deploy_workforce_template()`, unchanged), (2) connect
  Gmail/HubSpot/Hunter.io (reuses the existing `IntegrationsPanel`), (3)
  launch a campaign. Each step reads real database state on every load
  (not client-only wizard state), so a Gmail OAuth redirect or a page
  refresh never loses progress.
- 🎯 **Guided campaign launch** (`lib/campaigns.ts`) — a business user
  describes who they're selling to (industry, company size, location, ICP
  description) instead of writing a task description by hand. If they
  paste real target-company domains, those are used directly; if not, an
  LLM suggests candidate domains via the existing provider abstraction —
  clearly labeled "AI-suggested" everywhere it's shown, since Hunter.io
  (the only real prospect data source here) enriches a *known* domain, it
  doesn't discover companies from a description. This one honest
  limitation is documented, not hidden — see `BLOCKERS.md` #1.
- 🖐️ **A real human-approval gate before any email sends** — `tasks`
  gained `requires_approval`/`approved_at`/`approved_by`. The Outreach
  Agent's capability now only drafts (never sends) when run — the draft
  is written to the same `tasks.output` column step-to-step data passing
  already used, and the task is flagged `requires_approval`. A new
  `approve_task_output()` RPC (supervisor-gated, same bar as
  `approve_goal_plan`) and a dedicated `sendApprovedOutreach()` action
  (deliberately outside `agent_executions` — same precedent as "Check
  Replies"/"Log a Booked Meeting" before it) are the only path that
  actually calls Gmail's send API. Every draft is shown in full before
  that click.
- ⏸️ **Pause / Resume / Stop Campaign** controls on the Campaign
  Dashboard needed no new schema at all — `organization_goals.is_paused`
  (Phase 6) and `lib/goals.ts`'s existing `setGoalStatus(..., 'failed')`
  already did exactly this; this sprint only surfaces them prominently in
  the guided UI instead of leaving them buried in the goal detail page.
- 📊 **Estimated Pipeline Value** — `organizations.avg_deal_value` (one
  new nullable column) + a `set_avg_deal_value()` RPC. `get_sales_metrics()`
  (Phase 10) is extended, not replaced, to multiply
  `meetings_booked × avg_deal_value` — the ROI dashboard is business
  outcomes (prospects, emails, replies, meetings, pipeline value), not AI
  metrics, per this sprint's explicit framing.
- 🛡️ **Every real integration call now classifies its own failure and
  retries once.** `lib/integrations/errors.ts` maps HTTP status → a
  specific sentence (401/403 → reconnect, 429 → rate limit/quota, 5xx →
  provider outage, network errors → connectivity) and retries transient
  failures once with backoff before surfacing them — consistently across
  Gmail, HubSpot, and Hunter.io. A single bad domain/contact/thread inside
  a batch (enrichment, CRM sync, reply-checking) no longer discards every
  other item in the same batch; each collects its own `failed` list
  instead of throwing on the first error.
- 📚 **New docs**: `GETTING_STARTED.md` (the non-technical first-run
  guide), `USER_GUIDE.md` (day-to-day reference), `TROUBLESHOOTING.md`
  (every real error message this platform produces, explained),
  `DEMO_GUIDE.md` (how to run a live demo with real accounts, never
  fabricated data), and `BLOCKERS.md` (every remaining gap, ranked
  Critical→Low, with a recommended fix for each).
- 🧪 **Verified against a real local Postgres 16 instance**, same
  discipline as every phase since 8 — a real bug was caught in the
  process: `get_sales_metrics()`'s widened return signature couldn't
  `CREATE OR REPLACE` over the 5-column version Phase 10 already left in
  place, on a *genuinely fresh* migration run (001 through this sprint in
  order), not just in re-used test-session state — fixed with an explicit
  `DROP FUNCTION` first. `approve_task_output()`, `set_avg_deal_value()`,
  and the pause/stop controls were each exercised as a real org owner
  (succeeds) and an unrelated `authenticated` outsider (blocked), in both
  directions.

## Customer Validation Sprint

No new platform layer, no new architecture. Goal: get this in front of 3-5
real design partners with confidence. Docker isn't available in this
sandbox, so a full local Supabase Auth stack couldn't be stood up to click
through the real UI — the same honest limitation this project has carried
since Phase 8. What was possible instead: a thorough code-level polish
pass (found and fixed several real bugs, one of them serious), a full
analytics funnel, a feedback system, a demo-org seed script, and design
partner readiness docs.

- 🔍 **Polish pass found real bugs, not hypothetical ones.** The domain-
  parsing regex (used since Phase 10 to pull target domains out of a task
  description) silently truncated any multi-level TLD — `acme.co.uk`
  became `acme.co`, a different, often real, unrelated domain — and any
  `www.`-prefixed domain — `www.acme.com` became `www.acme`, not even a
  valid hostname. A real UK/Australian/etc. design partner would have had
  their campaign silently target the wrong company. Fixed with one shared
  `extractDomains()` in `lib/utils.ts` (both `lib/runtime/salesActions.ts`
  and `lib/campaigns.ts` now import it instead of each keeping their own
  copy of the bug). Also fixed: a partially-failed campaign launch used to
  strand the user on a permanently empty Campaign tab with no way to
  retry; the onboarding wizard's own step indicators didn't update after
  connecting an integration or launching a campaign (client-side state
  staleness — `router.refresh()` alone doesn't reach a client component's
  own local state); and campaign stage buttons offered to run before their
  required integration was even connected, producing a confusing runtime
  error instead of a clear "connect X first" prompt.
- 📈 **Full funnel tracking, no new ledger.** Organization created,
  workforce deployed, campaign launched, emails drafted, emails sent,
  replies received, meetings booked — the first three reuse
  `organization_activity` (a new trigger on `organizations`, a new log
  call inside `deploy_workforce_template()`, and a new self-authorizing
  `record_campaign_launched()` RPC); "emails drafted" is one more
  `sales_activities.activity_type`, logged the same way `lead_found`/
  `email_sent` already are. A new admin-only `/analytics` page shows both
  the network-wide funnel and a per-organization breakdown — which design
  partners actually progressed, and where each one is stuck.
- 💬 **Feedback system** — a floating widget on every authenticated page
  (bug / feature request / general feedback, auto-capturing the page
  URL), a new `user_feedback` table (RLS: submitters see their own,
  admins see everyone's, only admins can change status), and an admin
  inbox at `/admin/feedback`.
- 🎭 **`scripts/seed_demo_org.sql`** — spins up a real demo organization,
  a real deployed B2B Sales Team workforce, and a real campaign structure
  in one script run, using the exact same `deploy_workforce_template()`
  and goal/plan/task mechanisms the guided onboarding flow uses. It does
  not fabricate any business outcome — no leads/sends/replies/meetings are
  inserted; the sample domains are clearly labeled as placeholders to
  replace before actually enriching.
- 📋 **`SUPPORT_PROCESS.md`** and **`SUCCESS_CRITERIA.md`** — how a
  design partner gets help and how fast, and exactly what "this pilot
  worked" means in checkable terms (per-partner and cohort-level bars),
  rather than a vague impression. `BLOCKERS.md` updated with every new
  finding from this sprint's polish pass.
- 🧪 **Verified the same way as every prior sprint** — every migration
  (001 through this sprint, 16 total) applied in order against a
  genuinely fresh local Postgres 16 instance with no errors;
  `record_campaign_launched()`, the analytics RPCs, and the feedback
  table's RLS were each exercised as a real org owner/admin (succeeds)
  and an unrelated outsider (blocked), in both directions; the demo seed
  script was run end to end and its funnel events confirmed in
  `organization_activity`.

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
   - `supabase/migrations/009_workforce_templates.sql` — templates, agent/workflow/goal blueprints, the deployment engine, lineage tracking, and metrics
   - `supabase/migrations/010_workforce_template_seeds.sql` — five real system templates (B2B Sales, Customer Support, Research, Content Marketing, Recruiting)
   - `supabase/migrations/011_simulation.sql` — simulation runs/events/metrics, the seeding/resolution engine, organization stress metrics, bottleneck analysis, network health, autonomy scoring, and executive reporting
   - `supabase/migrations/012_intelligence.sql` — agent/organization/workflow intelligence, the prediction and recommendation engines, self-optimization (human-approval-required), benchmarking, anomaly detection, and the extended (`daily`/`weekly`/`monthly`) executive report
   - `supabase/migrations/013_sales_integrations.sql` — integration credential storage, the sales activity ledger + metrics function, `agent_capabilities.integration_action`, and the B2B Sales Team template updates (Prospect Research / Outreach Send / CRM Sync, CRM Agent)
   - `supabase/migrations/014_stabilization.sql` — the duplicate-execution unique index, `capability_matches_task()` + the two-pass assignment fix, the `deploy_workforce_template()` security-definer fix, integration event logging to `organization_activity`, and the five `/diagnostics` RPCs
   - `supabase/migrations/015_campaign_experience.sql` — the human-approval-gate columns on `tasks` + `approve_task_output()`, `organizations.avg_deal_value` + `set_avg_deal_value()`, and the extended `get_sales_metrics()`
   - `supabase/migrations/016_customer_validation.sql` — the analytics funnel events (`organization_created` trigger, `workforce_deployed` logging, `record_campaign_launched()`, the `email_drafted` activity type), the two admin-only analytics RPCs, and the `user_feedback` table + RLS

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
- **The deployment engine trusts existing RLS instead of bypassing it.** Every write `deploy_workforce_template()` makes is scoped to the newly-created organization, which the deploying user owns — so the same policies that let any org owner create agents/workflows/goals for their own org are sufficient. No `security definer` was needed for a function this consequential, which is a stronger security posture than "trust the function."
- **A rolled-back transaction can't log its own failure.** If deployment fails partway, the whole transaction (org included) rolls back — so the app layer catches the RPC error and calls `log_failed_deployment()` as a separate call in a fresh transaction, rather than the deploy function trying to catch-and-log its own failure internally (which would also roll back along with everything else unless carefully isolated — not worth the complexity here).
- **Goal completion rate is measured per template, not per deployment.** `source_goal_blueprint_id` traces every deployed goal back to the blueprint that spawned it, so the metric aggregates across every organization that ever deployed the template — a more meaningful signal than any single deployment's snapshot.
- **No marketplace, payments, or public hiring were added in Phase 7**, per scope — this phase composes Phases 1-6's existing primitives into deployable bundles; it introduces no new business-transaction concepts.
- **This phase was verified against a real local Postgres instance** (a first for this project — every prior phase could only be reasoned about, since no live Supabase project was available). Every migration was applied in order against Postgres 16 with minimal Supabase-parity shims (an `auth.users`/`auth.uid()` stand-in, the `anon`/`authenticated`/`service_role` roles, and the `supabase_realtime` publication all exist for real on any Supabase project), then `start_simulation_run()` was actually executed end-to-end, first at a small scale and then at the exact default targets (100 agents / 20 orgs / 1000 tasks / 100 goals / 50 workflows) — it completed in ~5.3 seconds and hit every target exactly.
- **That verification pass caught two real, pre-existing bugs that predate Phase 8**, neither of which could have been caught without a real database: (1) migration 003's `agents.search_vector` generated column called `array_to_string()` directly — Postgres catalogs that function `STABLE`, not `IMMUTABLE`, for its polymorphic `anyarray` signature, so `GENERATED ALWAYS AS` rejects it outright; fixed with a thin `public.immutable_array_to_string()` SQL wrapper (safe to mark immutable for the `text[]` case this app actually uses). (2) migration 005 defined `is_org_manager()`/`is_org_member()` (both `language sql`) *before* creating the `organization_members` table they query — SQL-language functions are validated against the catalog at `CREATE FUNCTION` time (unlike `plpgsql`, which mostly defers to runtime), so this failed immediately; fixed by moving the two functions after the table. Both were fixed in place in their original migration files rather than patched forward, since — per the same verification — no live deployment of this schema had ever actually succeeded before now, so there was no live state to preserve.
- **The simulation surfaced a real cold-start dynamic, not a bug**: freshly created/deployed agents start at `trust_score = 0`, which the existing Phase 2 formula maps to a 40% task success floor — pessimistic for a single task, and it compounds sharply across a multi-step workflow (a 4-step workflow needs four independent rolls to succeed). Small test runs saw most workflow runs fail outright as a result. This is the system honestly reporting that a brand-new AI workforce needs to build a track record, exactly the kind of signal `/system-health` and the bottleneck analysis exist to surface — nothing in Phase 8 was tuned to make the numbers look better.
- **Deployed templates leave goals and workflows inert on purpose** (Phase 6/7 design: a human decides when to kick off a workflow, and a goal needs a plan a human or the real AI planner authors) — so `start_simulation_run()` explicitly activates every template-deployed goal (a synthetic single-step plan, since there are no LLM credentials in this environment to call the real planner) and workflow before topping up further, otherwise "prove templates can operate autonomously" would silently validate only the topped-up half of the world.
- **The run is synchronous — still no background worker in this stack.** `start_simulation_run()` executes its entire seed-and-resolve loop inline within one RPC call and one transaction; at the default scale that's low seconds, comfortably inside typical request/statement timeouts, but a much larger target (e.g. the spec's own "100,000 orgs / 10,000,000 agents" future-scale numbers from Phase 3) would need to move to a real job queue rather than one long-lived function call.
- **No marketplace, payments, or public hiring were added in Phase 8**, per scope — this phase only observes and stress-tests what Phases 1-7 already built.
- **Verified against the same real local Postgres instance as Phase 8**, and it again caught real bugs no amount of code review alone surfaced: (1) `recompute_agent_career()` originally tried to `select ... into` a `jsonb` column (`promotion_history`) directly into an `integer` variable — a runtime cast error on every call; fixed by computing `jsonb_array_length(...)` in the select instead of selecting the raw column. (2) `find_delegation_loops()` counted rows from `unnest(array[from_agent_id, to_agent_id])`, which doubles each delegation into two rows — `count(*)` was silently counting pairs, not delegations; fixed to `count(distinct d.id)`. (3) `find_underperforming_organizations()`'s `returns table (..., health_score numeric, ...)` OUT parameter shadowed the *actual* `organization_health.health_score` column in two bare (unqualified) references inside the function body, raising "column reference is ambiguous"; fixed by qualifying both with the table name. (4) The `generate_system_report()` "Biggest Risks" query used `DISTINCT ON (entity_id)` — which Postgres requires to `ORDER BY entity_id` first — then applied `LIMIT 10` directly on that, returning 10 arbitrary entities in UUID order rather than the 10 riskiest; fixed with a second ordering pass in an outer query. (5) `generate_recommendations_for_organization()` (callable by an org supervisor, not just an admin) originally called Phase 8's `find_overloaded_agents()`, which unconditionally requires `is_admin()` — an org supervisor invoking it would hit an authorization error inside their own recommendation generator; fixed by inlining an org-scoped equivalent query instead of reusing the platform-wide, admin-only finder. All five were caught by actually calling the functions end-to-end (including switching to a non-admin `authenticated` role with `SET ROLE` to verify RLS and authorization gates fire correctly in both directions), not just by reading the SQL.
- **Agent intelligence groups by department *id*, not name, deliberately** — every organization seeds the same seven standard department names (Phase 3), so grouping a cross-organization agent's task history by bare department name would silently merge two unrelated organizations' "Sales" departments into one statistic. Grouping by id (and naming the organization in the strength/weakness text) avoids that; `specializations` still stores the bare name, since cross-org matching in the recommendation engine ("does this org have a department matching one of this agent's proven strengths, regardless of which org they earned it in") is exactly the generalization that's useful there.
- **Every `predict_*` and `agent_review_recommendation` function checks authorization itself**, not just the batch-refresh wrapper that calls them — otherwise an authenticated user could call `predict_organization_risk()` directly via `supabase.rpc()` for an organization they have no relationship to. Each resolves the entity's owning organization and requires `is_admin()` or `is_org_supervisor()` (or, for agent-level predictions, agent ownership) before doing anything.
- **`organization_health`, `agent_profiles_intelligence`, and `agent_careers` are public**, matching `organization_metrics`' (Phase 3) and the agent table's (Phase 1-2) existing "public professional network" visibility — they're deeper derived views of signals that were already public. `workforce_insights`/`workforce_predictions`/`workforce_recommendations` are admin-only, matching Phase 8's simulation/reporting precedent, since these are operational suggestions and forecasts, not profile data.
- **No marketplace, payments, crypto, hiring, external clients, or new organization systems were added in Phase 9**, per scope — every table here is derived entirely from data Phases 1-8 already produce, and every recommendation requires a human's explicit approval before `apply_recommendation()` changes anything.
- **No new agent, workflow, or intelligence system was added in Phase 10** — a capability is executed exactly the same way it always has been (`runAgentExecution()`, Phase 5); the only change is that a capability tagged with an `integration_action` now performs a real HTTP call to a real provider instead of only calling the LLM. Everything else — task creation, workflow step advancement, the decision engine, wallet debits — is unchanged.
- **Step-to-step data passing reuses `tasks.output`, an existing column, rather than a new mechanism.** The Outreach step reads the real leads the Research step found, and the CRM step reads both the leads and which ones were actually emailed, by looking at every other completed task's `output` in the same `workflow_run_id` — the same "deliverable" column Phase 4 already built tasks around, just populated with real structured data instead of a raw LLM text blob.
- **HubSpot and Hunter.io connect via a pasted token, not OAuth** — both providers' own current recommendation for a single-account custom integration, and the pragmatic choice given this environment has no live OAuth app registered with either. Gmail *does* use real OAuth2, since Google requires it and a registered `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` is realistic homework for whoever deploys this. An OAuth app for HubSpot would be the natural next step for a multi-account, install-from-marketplace product.
- **Company *discovery* from a target-market description is out of scope; company *enrichment* from a known domain is what's built.** Hunter.io's real, free-tier Domain Search API turns a domain into real people — it does not turn "Series A fintech SaaS companies" into a list of domains. That needs a paid firmographic API (Apollo, Clearbit Discovery, ZoomInfo). The `ProspectProvider` interface exists precisely so that's a config change later, not a rewrite; today, an operator seeds target domains directly (in the "Research Prospect" task's description), which is exactly how many real SDR workflows already start — from an account list, not a blank industry filter.
- **This phase's database layer was verified the same way Phases 8-9 were** — every migration applied against a real local Postgres instance, `deploy_workforce_template()` was actually run and its deployed agents' capabilities confirmed correctly tagged with `integration_action`, and every RLS/RPC authorization boundary (`organization_integrations`, `sales_activities`, `connect_integration`, `record_sales_activity`) was exercised as both the legitimate owner and an unrelated `authenticated` user via `SET ROLE`, in both directions. What could **not** be verified here: any actual live call to Gmail, HubSpot, or Hunter.io, since this environment has no real credentials for any of the three — the same honest limitation Phase 5's LLM providers have always carried.
- **Assignment and billing are now two separate questions, not one.** `assign_best_agent_for_task()` used to pass a candidate's matched capability straight into `decide_agent_accept_task()`, which both gates capacity/status *and* checks wallet balance for that capability's cost. That conflated "is this the right agent for this task" with "can this agent currently afford to run it" — harmless while the capability match was almost never found (the old `ILIKE` matcher's bug), but actively wrong once matching started working: a fresh agent's $0 wallet made the *correct* agent lose to an unrelated, nominally-free one. Assignment now always passes a `null` capability into that call; the real balance check still happens, correctly, at execution time.
- **A `security definer` gap can hide for a long time if local testing is too permissive.** `deploy_workforce_template()`'s missing `security definer` (see Stabilization Sprint 1 above) went undetected across Phases 9 and 10 because this project's own local-Postgres testing habit of granting broad `EXECUTE` to `authenticated` before running checks silently papered over it every time. The fix wasn't just the code change — it was re-running every migration's explicit `revoke` statements before re-testing, so the test environment's grants actually matched what a real Supabase project would have.
- **No new architecture, tables, or business concepts were added in Stabilization Sprint 1**, per scope — the unique index, the improved matcher, the security-definer fix, and the five diagnostics RPCs all read or write tables/columns that already existed (with one additive column, `agent_executions.integration_action`, denormalized purely so the partial unique index can target it directly).
- **Splitting outreach into draft-then-send needed no new `integration_action` and no new workflow step.** The Outreach Agent's single capability still runs through the exact same `runAgentExecution()` → `dispatchIntegrationAction()` path as every other capability — only its internal behavior changed (it stops before calling `sendEmail`). Sending is a second, separate, human-triggered action outside `agent_executions` entirely, following the exact precedent "Check Replies" and "Log a Booked Meeting" already set in Phase 10: a direct, audited action, not a capability re-run — which also sidesteps Stabilization Sprint 1's duplicate-execution guard cleanly, since there's still exactly one execution row per task.
- **A "campaign," in the guided UI, is just the org's "Generate Leads" goal** — no new entity was introduced. Pause/Resume/Stop needed zero new schema because `organization_goals.is_paused` (Phase 6) and `setGoalStatus(..., 'failed')` (already in `lib/goals.ts`) already did exactly what Phase D asked for; this sprint's only job was surfacing them prominently instead of leaving them on the goal detail page.
- **The guided campaign form is honest about a real capability gap, not silent about it.** Hunter.io's Domain Search (the only prospect data source this platform has) enriches a *known* domain — it cannot discover companies from an industry/size/location description, the way the ICP-driven form's framing implies. Rather than fabricate that capability, an LLM-suggested candidate-domain list (via the existing provider abstraction, no new integration) fills the gap, labeled "AI-suggested" everywhere it surfaces. Real, verified people only ever come from Hunter actually enriching a domain — pasted or suggested.
- **No new architecture was added in the Campaign Experience Sprint either** — `/onboarding` and the Campaign Dashboard are new frontend orchestration over existing RPCs (`deploy_workforce_template`, `connect_integration`, `approve_goal_plan`, `runAgentExecution`, `get_sales_metrics`); the only new SQL surface is the human-approval-gate columns/RPC and the average-deal-value column/RPC, both additive.
- **A shared domain parser exists so a fix only ever needs to happen once.** `lib/runtime/salesActions.ts` and `lib/campaigns.ts` used to each keep their own copy of the same domain-extraction regex — meaning the multi-level-TLD/`www.`-prefix truncation bug (see the Customer Validation Sprint notes above) would have needed fixing twice, and easily could have been fixed in only one place and missed in the other. `extractDomains()` now lives once in `lib/utils.ts`; both callers import it.
- **Client-side state staleness is a real, recurring risk whenever a component known to work standalone gets reused inside another client component with its own local state.** `IntegrationsPanel` and `CampaignLaunchForm` both call `router.refresh()` on success, which is correctly sufficient when they're rendered directly inside a server-component route (the organization page) — but `/onboarding` wraps both in a client component (`OnboardingWizard`) that fetches its own state via the browser client (needed so a Gmail OAuth redirect doesn't lose wizard progress). `router.refresh()` re-fetches server props; it does not touch a sibling client component's local state. The fix (optional `onChange`/`onConnected`/`onDisconnected`/`onLaunched` callback props, additive and backward compatible for every other existing caller) is a pattern worth remembering for any future reuse of these components in a new client-side context.
- **Analytics funnel events reuse two existing ledgers, not a new one.** Organization/workforce/campaign events go through `organization_activity` (a new trigger + two new log call sites + one new self-authorizing RPC); "emails drafted" is one more `sales_activities.activity_type`, logged exactly like `lead_found`/`email_sent` already are. `get_analytics_funnel()`/`get_analytics_by_organization()` are read-only aggregations over data that already exists.
- **Feedback needed one new table, not a new subsystem.** `user_feedback` follows the exact RLS shape already established elsewhere in this schema (submitter sees their own via a straightforward `user_id = auth.uid()` policy; admin sees everything via `is_admin()`; only admins can update status) — no RPC wrapper needed since the RLS policies alone are sufficient, the same pattern `task_reviews` already uses.

## Project structure

```
app/
  (auth)/login, (auth)/signup   – email/password auth
  auth/callback                 – OAuth/email confirmation code exchange
  api/agents/search              – GET search/filter/sort/paginate endpoint
  api/tasks                     – GET (list, filtered) / POST (create) task API
  api/executions                – GET (list, filtered) / POST (run) execution API
  api/goals/[id]/plan           – POST: draft a plan for a goal via the LLM provider
  api/integrations/gmail/connect  – GET: redirect into Google's real OAuth2 consent screen
  api/integrations/gmail/callback – GET: exchange code for tokens, store via connect_integration()
  api/integrations/check-replies  – POST: on-demand Gmail reply detection for an organization
  api/campaigns/launch           – POST: create/reuse a campaign goal + plan from ICP fields
  api/campaigns/approve-and-send  – POST: approve a drafted outreach task and send it for real
  (app)/                        – authenticated shell
    onboarding                    – guided flow: create org & deploy workforce → connect
                                   integrations → launch campaign, one page, real DB state
    templates                    – browse templates with live usage/success/completion metrics
    templates/[id]                – preview (agents, workflow, goals) + deploy form
    agents                      – global directory: search, filters, sort, pagination
    agents/new                  – agent registration
    agents/top                  – rankings / leaderboards
    agent/[id]                  – agent profile: identity, trust score, performance,
                                   credentials, portfolio, wallet (owner), reputation, activity
    agent/[id]/edit             – owner-only: details, categories, verification requests
    admin/verifications         – admin-only: approve pending verification requests
    organizations               – organization directory (search by name, pagination)
    organizations/new           – organization creation
    organizations/[id]          – dashboard: Overview / Campaign / Departments / Agents /
                                   Performance / Tasks / Workflows / Activity / Sales Pipeline /
                                   Integrations / Setup Wizard (via ?tab=)
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
    system-health                – admin-only: network health, autonomy score, simulation run
                                   history, bottleneck analysis, run-simulation + report generation
    intelligence                  – admin-only: Agents/Organizations/Workflows/Predictions/
                                   Recommendations/Anomalies/Reports tabs
    diagnostics                   – admin-only: execution history, integration history,
                                   failures, retries, assignment decisions
    analytics                     – admin-only: network-wide funnel + per-organization
                                   breakdown (org created/workforce deployed/campaign
                                   launched/emails drafted+sent/replies/meetings)
    admin/feedback                 – admin-only: bug/feature-request/feedback inbox
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
  templates                     – template card, deploy form, metrics panel
  system-health                 – run-simulation button, network health/autonomy score panels,
                                   simulation run list, bottleneck panel, report generation/card
  intelligence                  – tabs, agent/organization/workflow intelligence lists, template
                                   rankings, predictions list, recommendation card (approve/reject/
                                   apply), org-scoped refresh/generate controls, anomalies panel
  sales                          – integrations panel + token connect form + disconnect button,
                                   sales metrics panel, activity feed, check-replies button,
                                   log-a-booked-meeting form, setup wizard panel
  diagnostics                    – execution history, integration history, failures, retries,
                                   and assignment-decision panels
  onboarding                     – the guided onboarding wizard (org/deploy/integrations/campaign,
                                   one client component driven by real DB reads on each step)
  campaigns                      – campaign launch form, campaign dashboard, per-stage run
                                   button, prospects review list, drafts review + approve & send,
                                   pause/resume/stop controls
  analytics                      – funnel panel, per-organization table
  feedback                       – floating feedback widget (every authenticated page),
                                   admin status-change control
lib/
  providers                     – ModelProvider abstraction: OpenAI, Anthropic, local/Ollama
  integrations                   – EmailProvider/CrmProvider/ProspectProvider abstraction: Gmail
                                   (OAuth2 + REST), HubSpot (private app token), Hunter.io (domain
                                   search), plus shared HTTP error classification + bounded retry
  runtime                       – execution orchestration (decision engine -> provider -> tracking;
                                   dispatches to a real integration action when a capability is
                                   tagged for one), sales action handlers (draft-only outreach),
                                   the separate approved-send action, on-demand reply checking,
                                   AI plan generation
  campaigns.ts                   – ICP-driven campaign launch (with AI-suggested domain fallback)
                                   + campaign dashboard state aggregation
  analytics.ts                   – funnel + per-organization analytics reads
  feedback.ts                    – submit/list/update feedback
  supabase, types, agents/registry/organizations/tasks/agentRuntime/goals/templates/simulation/
                                   intelligence/sales/diagnostics data-access helpers
scripts/
  seed_demo_org.sql              – spins up a real demo organization, workforce, and
                                   campaign structure via the same RPCs the app uses
supabase/migrations             – database schema + RLS + RPCs
middleware.ts                   – route protection
```

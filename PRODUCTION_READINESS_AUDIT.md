# Production Readiness Audit — Phase 22

A complete pass over every item Phase 22's mission named, verified
against the actual code and configuration in this repository, not
assumed. Same severity convention as `RELIABILITY_REPORT.md` (Critical /
High / Medium / Low). Where a prior report already covers an item, this
audit restates its current status rather than re-investigating from
scratch, so the two documents don't drift apart.

## 1. Environment variables

Every variable the app reads, cross-checked against `.env.example`:

| Variable | Required for | Verified |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase access | ✅ documented |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Supabase access | ✅ documented |
| `NEXT_PUBLIC_APP_URL` | OAuth redirect construction | ✅ documented |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/cron/process-jobs` only (`lib/supabase/service.ts`) | ✅ documented, scoped comment explains the one deliberate exception |
| `CRON_SECRET` | Bearer-auth gate on the cron route | ✅ documented |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI provider (agents, reply classification) | ✅ documented |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Anthropic provider | ✅ documented |
| `LOCAL_MODEL_URL` / `LOCAL_MODEL_NAME` | Ollama-compatible local provider | ✅ documented |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Gmail OAuth | ✅ documented |

**Finding (Low):** No startup-time validation that required variables are
actually set — a missing `GOOGLE_CLIENT_ID` only surfaces the first time
a user clicks "Connect Gmail" (`getGmailOAuthUrl` throws, caught and
shown as a redirect `?error=`). Acceptable for the current scale (a
handful of design partners, deploy-time config review is realistic) but
worth a boot-time check before a larger rollout.
**Status: Documented, not fixed — out of this phase's scope.**

## 2. OAuth flows

Only Gmail uses real OAuth (`app/api/integrations/gmail/connect/route.ts`,
`app/api/integrations/gmail/callback/route.ts`). HubSpot and Hunter.io are
deliberately not OAuth — a design partner pastes a Private App token /
API key directly (`DEPLOYMENT_GUIDE.md` §4–5) — so there is no HubSpot or
Hunter OAuth flow to audit.

**Finding (Medium):** The Gmail flow's `state` parameter is only the
organization id (optionally suffixed `|onboarding`), not a signed or
random per-attempt nonce checked against server-stored state. This means
`state` provides routing information, not real CSRF protection — an
attacker who could get a victim to visit a crafted callback URL could, in
principle, attempt to bind their own authorization code to someone else's
org id. In practice this is not exploitable: `connect_integration()`
re-checks `is_org_manager(org_id, auth.uid())` server-side before writing
anything (`supabase.rpc('connect_integration', ...)` in the callback), so
the real authorization boundary holds regardless of what `state` says —
but relying on that as the only defense is thinner than a standard
signed-state OAuth implementation.
**Status: Real gap, not exploitable today because of the RPC's own
authorization check — worth hardening (a signed state token) before a
larger partner count increases the attack surface.**

## 3. Gmail integration

Real OAuth2, real token exchange (`lib/integrations/gmail.ts`), refresh
token stored per-organization in `organization_integrations.credentials`.
Send and reply-check both go through the real Gmail API
(`lib/runtime/checkReplies.ts`, the Outreach Agent's send capability).

**Finding (Medium, carried over):** Credentials are stored as plain
`jsonb`, not encrypted at rest — restated from `RELIABILITY_REPORT.md`
M2. Read access is scoped to `is_org_manager()` or `is_admin()`
(`organization_integrations_select` policy, migration 013) and there is
no direct insert/update policy — only the security-definer
`connect_integration()`/`disconnect_integration()` RPCs write this table
— so the credential is never reachable by a client-side `.insert()` or by
another organization's members. Column-level encryption remains a real
improvement, not yet done.
**Status: Documented, not fixed — same posture as before this phase.**

## 4. HubSpot integration

Private App access token pasted by an org manager, stored the same way
as Gmail's credentials, same RLS/RPC access pattern. CRM sync
(`runAgentExecution` → CRM Sync capability) creates/updates real HubSpot
contacts. No OAuth to audit (see §2).

## 5. Hunter.io integration

API key pasted the same way. Lead enrichment
(`lib/integrations/hunter.ts`) calls the real Hunter.io domain-search API.
No OAuth to audit.

## 6. Cron jobs

`vercel.json` defines one cron: `/api/cron/process-jobs` on `0 0 * * *`
(daily — changed from an original hourly schedule after Vercel's Hobby
plan rejected sub-daily cron expressions at deploy time). The route
(`app/api/cron/process-jobs/route.ts`):
- Validates `Authorization: Bearer $CRON_SECRET` before any database
  access — confirmed by reading the route directly, not just the
  Phase 21 README claim.
- Schedules recurring jobs per organization and per job type
  (`RECURRING_CADENCE_HOURS`), skipping `progress_campaign` for
  organizations below autonomy level 3.
- Processes claimed jobs through `runJobHandler`.

**Finding (Low):** A single daily cadence is a real constraint — a reply
received just after the run isn't checked until roughly a day later.
Acceptable for a first cohort of design partners (nothing in the mission
calls for sub-daily latency), and required by the Hobby plan's cron
limits regardless. A paid Vercel plan (Pro/Enterprise) removes the
restriction and lets the schedule move back to hourly if real usage data
shows the latency causes missed follow-ups.
**Status: Acceptable for current scale, flagged for revisit once on a paid plan.**

**Finding (Low):** Vercel Cron has no built-in alerting if a scheduled
invocation fails outright (times out, 5xx) rather than completing with
job-level failures recorded in `job_failures`. The Error Center
(`/admin/support`) surfaces failures *within* a successful cron
invocation; it cannot surface "the cron invocation itself never ran."
**Status: Real gap — see §9 Monitoring.**

## 7. Worker execution

Verified by direct code read, not assumption: `runJobHandler`
(`lib/runtime/jobHandlers.ts`) dispatches on `job.job_type` to handlers
that reuse the exact same business-logic RPCs and `runAgentExecution()`
path a human's button click uses — confirmed no parallel "background-only"
logic exists outside the four job-queue-management RPCs, which
legitimately have no non-system equivalent. `claim_next_jobs_system` uses
`for update skip locked`, so concurrent invocations (e.g. a slow-running
previous invocation overlapping the next hourly trigger) cannot double-
claim the same job — confirmed structurally by reading the function, and
behaviorally by `scripts/test_critical_paths.sh`'s job-queue checks. This
matters less at a daily cadence than it did at hourly, but the guarantee
holds regardless of schedule.

## 8. RLS policies

Not asserted — verified by running `scripts/test_critical_paths.sh`
against a genuinely fresh local Postgres 16 database on this date: **19/19
checks pass**, covering `is_system_caller()`, the job queue's
service-role-only functions (including a real Postgres-level `permission
denied`, not just an app-level rejection, for an authenticated caller),
reply classification, deal outcomes, revenue attribution, and audit log
RLS — each proven in both directions (the legitimate owner succeeds, an
unrelated outsider is blocked).

**Finding (Low):** The regression script covers Phase 21/22's newest
surfaces in depth but does not exhaustively re-test every RLS policy from
migrations 001–020 (e.g. task/workflow/template RLS). Those were verified
manually in their own phases (see each phase's README section) but are
not part of the durable, re-runnable script yet.
**Status: Documented gap — expanding the script's coverage is reasonable
future work, not done this phase.**

## 9. Monitoring

What exists today, confirmed by reading the actual pages/components:
- **Error Center** (`/admin/support`, `ErrorCenterPanel.tsx`) — every
  failed background job (`job_failures`), with organization, job type,
  retrying/failed status, real error message, and a resolve action.
- **Audit log** (`AuditLogFeed.tsx`, per-organization Activity tab) —
  sensitive action history (autonomy changes, experiment conclusions,
  revenue events, campaign launches, deal outcomes).
- **System Health** (`/system-health`, admin-only) — network health,
  autonomy score, bottleneck analysis, simulation runs.
- **Diagnostics** (`/diagnostics`, admin-only) — execution history,
  integration history, execution failures, retry counts, assignment
  decisions.

**Finding (High):** None of the above is *pushed* — every one requires an
admin to open the page. There is no alerting (email/Slack/webhook) when a
job fails, a cron invocation doesn't run, or a health score crosses into
`critical`. For a first real design-partner cohort this is a genuine
operational risk: a stalled campaign or a broken integration could go
unnoticed until someone happens to check `/admin/support`.
**Status: Real gap, not fixed this phase — the honest scope call was
building the data (Error Center, audit log, health scores) before
building alerting on top of it. Flagged as the top priority for whichever
phase follows.**

## 10. Backup strategy

**Finding (High):** This project has no backup strategy of its own —
verified by searching the repo for any backup/export tooling beyond the
existing per-organization JSON debug export
(`/api/admin/support/export`, built for support debugging, not disaster
recovery). Database durability depends entirely on whatever the hosting
Supabase project's plan provides (paid Supabase tiers include point-in-
time recovery; the free tier does not). This has never been documented
anywhere in the repo before this audit.
**Status: Real, previously-undocumented gap.** Recommended before onboarding
real paying customers: (1) confirm the production Supabase project is on
a plan with point-in-time recovery enabled, (2) add a scheduled
`pg_dump` (or Supabase's own backup export) to cold storage independent
of the hosting provider, (3) document and periodically test an actual
restore — none of which this phase built, since it is infrastructure
configuration outside this codebase, not a coding task.

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | No boot-time env var validation | Low | Documented |
| 2 | OAuth `state` is a routing hint, not a CSRF nonce | Medium | Documented, not exploitable today |
| 3 | Integration credentials unencrypted at rest | Medium | Documented (carried over) |
| 4 | Daily cron cadence (Hobby plan limit) | Low | Acceptable, flagged for revisit on a paid plan |
| 5 | No alerting on a failed cron invocation itself | Low | Real gap, see #6 |
| 6 | No alerting/monitoring push (email/Slack/webhook) | **High** | Real gap, top priority next |
| 7 | No backup strategy documented or implemented | **High** | Real, previously-undocumented gap |
| 8 | Regression script doesn't cover migrations 001–020 exhaustively | Low | Documented gap |

Nothing above blocks onboarding the first real design partners — every
Critical-severity path (RLS authorization, job queue integrity, credential
access scoping) was verified and holds. The two High findings (alerting,
backups) are real operational risks worth addressing before scaling past
a small, closely-watched cohort, and are named here rather than left
undiscovered.

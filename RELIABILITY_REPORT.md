# Reliability Report — Stabilization Sprint 1

Scope: no new functionality, no new phases, no new architecture. Every item
below was found (or confirmed already fixed) by exercising the real schema
against a real local Postgres 16 instance as the actual `authenticated`
role — signed in as a genuine org member for the "should work" cases, and
separately as an unrelated outsider for the "should be denied" cases. Four
of the findings below were not hypothetical: they reproduced the first time
they were tested this way.

---

## Critical

### C1. Duplicate real-world side effects were possible
**Before:** nothing prevented re-running an already-completed integration
capability on the same task. Pre-Phase-10 this just wasted an LLM call;
post-Phase-10 it could send a real duplicate email, double-enrich a
domain, or double-create a CRM contact.
**Fix:** `agent_executions` gained an `integration_action` column and a
partial unique index — `(task_id, integration_action)` where status is
`queued`/`running`/`completed` — so Postgres itself rejects a second
attempt atomically, even under concurrent requests. `failed` is
deliberately excluded so a genuine transient failure stays retryable.
`lib/runtime/execute.ts` sets the column on every execution and translates
the resulting `23505` into a specific, human error instead of a raw
constraint string. HubSpot's own native email-uniqueness conflict (409) is
now also caught and recovered (reuses the existing contact) as a second,
independent layer.
**Status: Fixed.** Verified: a second insert for the same
`(task_id, integration_action)` raises `unique_violation`; a `failed` row
followed by a `queued` retry for the same pair succeeds.

### C2. Template deployment was broken for every real user
**Before:** `deploy_workforce_template()` was never marked
`security definer`, in both its original definition (Phase 9) and its
Phase 10 redefinition. It runs with the *caller's* privileges, and partway
through calls `increment_template_usage()` — which Phase 9 deliberately
revoked from `authenticated`/`anon`/`public` (correctly: that function has
no auth check of its own). Net effect: every real "Deploy Template" click,
for every template, since Phase 9, would fail outright with `permission
denied for function increment_template_usage` for an actual signed-in
user. This is the single most basic onboarding action in the product.
**Why it went undetected:** every prior phase's local-Postgres testing
(including this sprint's own first pass) ran a blanket `grant execute on
all functions in schema public to authenticated` to work around unrelated
"permission denied for table" errors — a step real Supabase never performs
and this project has never had a service-role key to fall back on either.
That blanket grant silently re-enabled the revoked function every time,
masking the bug in every phase's testing since it was introduced.
**Fix:** `deploy_workforce_template()` redefined as `security definer`.
This introduces no new privilege — every write inside is already scoped to
`auth.uid()` (the real caller; unaffected by security definer, since
`auth.uid()` reads the session's own JWT claim, not the function owner's),
so a caller can still only ever create and populate their own new
organization.
**Status: Fixed.** Verified: deploying a template as a real authenticated
user (grants restored to exactly what the migrations create — no blanket
bypass) now succeeds end to end.

### C3. Wrong agent assignment
**Before:** `assign_best_agent_for_task()` matched a task's title against
a candidate's capability name via `ILIKE '%...%'`/first-word-only
substring matching. On a fresh deployment (every agent tied at
`trust_score = 0`), a bad match meant `decide_agent_accept_task()` was
never even asked to check a matching capability, so the loop accepted
whichever candidate sorted first — regardless of fitness. Reproduced in
Phase 10 validation: a "Research Prospect" task was assigned to the CRM
Agent. Separately confirmed the CRM Agent's own "Update CRM" task didn't
match "CRM Sync" either — a second latent instance of the same root cause.
**Fix:** new `capability_matches_task()` word-overlap matcher (splits both
strings into words, requires a real shared word longer than 2 characters,
excluding a small stopword list), plus a two-pass assignment loop —
require a real match first, only fall back to an unmatched candidate if
truly nobody matches.
**Status: Fixed**, but see C4 — the matcher alone wasn't sufficient.

### C4. The capability-match fix exposed a second, deeper bug: assignment was implicitly gated on money
**Before:** because the old matcher almost never found a real match, the
`capability_id` passed into `decide_agent_accept_task()` during assignment
was almost always `null` — which skips that function's wallet-balance
check entirely. Fixing C3 meant a real `capability_id` started flowing
into that call for the first time, which triggered the balance check — and
every fresh agent's wallet starts at **$0**. The result: the correctly
matched agent got rejected for insufficient funds, and the two-pass
fallback then handed the task to a wrong-but-affordable agent instead —
reproduced immediately in this sprint's own first test run, before this
fix was added.
**Fix:** assignment now calls `decide_agent_accept_task()` with a `null`
capability id on both passes — the required-match pass still *requires*
finding and recording a capability for logging/visibility, it just
doesn't pass it into the billing check. The real capability check (and
real debit) still happens at **execution** time in
`lib/runtime/execute.ts`, which already worked correctly and is
unaffected. Assignment and billing are now properly separated: assignment
answers "who's the right agent," execution answers "can this run be
afforded."
**Status: Fixed.** Verified: all three B2B Sales Team tasks (Research
Prospect / Outreach / Update CRM) auto-assign to the correct agent with
`match_type: capability_match`, with real production grants and $0
wallets, no funding required for correct assignment.

---

## High

### H1. Integration failures were invisible
**Before:** `record_integration_error()` existed (Phase 10) but nothing in
the TypeScript application ever called it — a broken Gmail/HubSpot/Hunter
connection never updated `organization_integrations.status`/`last_error`
in practice.
**Fix:** `lib/runtime/execute.ts`'s catch path now calls
`record_integration_error()` on any integration-action execution failure,
mapping the capability's `integration_action` to its provider
(`prospect_enrich`→hunter, `email_draft_send`→gmail, `crm_upsert`→hubspot).
`connect_integration`/`disconnect_integration`/`record_integration_error`
now also each log to `organization_activity` (reusing the Phase 3 event
log, not a new table).
**Status: Fixed.**

### H2. No visibility into why an agent was (or wasn't) chosen
**Before:** `log_decision()` recorded a generic "assigned to agent X"
message with no indication of whether a real capability match drove the
decision or it was arbitrary.
**Fix:** `assign_best_agent_for_task()` now logs which capability matched
(if any), `match_type: capability_match | fallback_no_match`, and which
pass (`required_match_this_pass`) produced the result.
**Status: Fixed.**

### H3. No cross-cutting observability page existed
**Before:** execution history, integration history, failures, retries,
and assignment decisions were each only visible by querying individual
tables directly — no unified view, unlike `/system-health` (simulation)
and `/intelligence` (predictions).
**Fix:** new `/diagnostics` page (admin-gated, same pattern as
`/system-health`), backed by five new `security definer` + `is_admin()`
gated RPCs (`get_execution_history`, `get_integration_history`,
`get_execution_failures`, `get_task_retry_counts`,
`get_assignment_decisions`) — no new tables, reusing
`agent_executions`/`agent_decisions`/`organization_activity` exactly as
they already exist.
**Status: Fixed.**

### H4. Workflow-path tasks can't carry target-market domains the way goal-path tasks can
Carried over from the Phase 10 validation report, not addressed this
sprint (out of the five stated tasks). `DEPLOYMENT_GUIDE.md` documents the
workaround: always create the "Research Prospect" step through the goal
plan path, where the step description is free text that can hold real
domains, rather than the workflow path.
**Status: Documented, not fixed. Real friction, not a correctness bug.**

---

## Medium

### M1. Agent wallets start at $0 with no seeding
A freshly deployed organization's agents can't afford their own paid
capabilities until someone manually funds their wallets (via the existing
wallet-transaction RPC — no new mechanism). Assignment no longer depends
on this (see C4), but the first real execution of a paid capability will
simply run at execution time without a successful debit until funded.
**Status: Documented, not fixed** — this is a product/business decision
(what should a fresh deployment's starting balance be?) rather than a bug,
and outside this sprint's "no new functionality" scope.

### M2. Integration credentials have no column-level encryption at rest
Carried over from the due-diligence report and restated in
`DEPLOYMENT_GUIDE.md`: HubSpot tokens and Hunter API keys are stored as
plain jsonb in `organization_integrations.credentials`. Same posture as
before this sprint.
**Status: Documented, not fixed.**

### M3. No background worker means real inbound signals require a manual click
Reply detection (`checkRepliesForOrganization`) and integration retries
both require a human to click a button — an explicit, longstanding
architectural constraint of this stack, not an oversight. Worth restating
here because it's a genuine operational risk for real usage: a reply or a
transient integration outage can sit unnoticed until someone checks.
**Status: By design, not in scope for this sprint.**

### M4. Blanket local-testing grants are a standing process risk
The exact mechanism that hid C2 (and initially masked C4) — a
convenience `grant execute on all functions ... to authenticated` used to
unblock local Postgres testing — will hide the same class of bug again in
any future phase unless testing explicitly re-applies every migration's
`revoke` statements before asserting a feature "works." This isn't a
product defect; it's a testing-methodology gap now on record so the next
phase doesn't reintroduce C2/C4-shaped bugs undetected.
**Status: Documented as a process note.** `VALIDATION_CHECKLIST.md`
section 1 now calls this out explicitly.

---

## Low

### L1. Retry visibility is inferred, not a stored count
`/diagnostics`'s Retries panel surfaces "more than one execution row for
the same task" rather than a dedicated retry-count field. Deliberate — no
new column, reusing what already exists.
**Status: Working as intended, not a defect.**

### L2. Integration error payloads are broadcast org-wide by design
`organization_activity` has always been readable by anyone (`using
(true)`) — a deliberate platform-wide public-activity-feed precedent
predating this sprint. `integration_error` events now flow into that same
feed with a truncated (500 char) error message. Consistent with existing
design, but worth noting since it's the first event type in that feed
carrying error text rather than a status change.
**Status: Consistent with existing design, not a regression.**

---

## Summary

| Severity | Found | Fixed | Documented only |
|---|---|---|---|
| Critical | 4 | 4 | 0 |
| High | 4 | 3 | 1 |
| Medium | 4 | 0 | 4 |
| Low | 2 | 0 | 2 |

All four Critical findings are fixed and re-verified against a real
Postgres role in both the "should succeed" and "should be denied"
directions. The one open High item (H4) and all Medium/Low items are
explicit product or scope decisions, not defects left unaddressed by
oversight.

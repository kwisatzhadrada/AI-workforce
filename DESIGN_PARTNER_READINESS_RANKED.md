# Design Partner Readiness — Ranked for the First 5 Paying Partners

A fresh assessment, not a restatement of `DESIGN_PARTNER_READINESS_REPORT.md`
(written for the first *unpaid* design partner cohort, several phases
ago). This one assumes real money changing hands, which raises the bar:
billing, legal terms, and account-safety guarantees all become real
requirements they weren't before. Every item below was checked against
the actual code, not assumed.

## Critical — blocks "ready for paid customers" outright

1. **There is no way to actually charge anyone.** No Stripe integration,
   no invoicing, no payment collection anywhere in this codebase.
   `lib/revenue.ts`'s `revenue_events` table is an admin-entered ledger of
   deal stage (trial started, subscription started, cancelled) — a CRM
   for tracking the sales relationship, not a mechanism that moves money.
   This has been a standing, deliberate constraint across every phase of
   this project ("no payments beyond the internal wallet ledger"), which
   was the right call while validating product-market fit — but it means
   literally none of this sprint's other findings matter until a real
   payment processor is wired in. **This alone is why the answer to "is
   it ready for paid customers" in `LAUNCH_VERDICT.md` is no.**
2. **No outbound send rate-limiting.** `lib/runtime/salesActions.ts` and
   the Outreach Agent's send capability have no daily cap or pacing on
   how many emails go out through a design partner's own connected Gmail
   account. A real campaign sending dozens or hundreds of cold emails in
   a short window is exactly the pattern Google's abuse detection flags —
   risking the partner's own Gmail account being rate-limited or
   suspended. This is the one finding in this entire report that could
   directly damage a real paying customer's own infrastructure, not just
   this product's reputation.
3. **No Terms of Service or Privacy Policy.** A paying customer is being
   asked to connect their real Gmail account and real CRM — real customer
   data, real business email — with no stated terms for what happens to
   it, no data retention policy, no stated liability. Searched the whole
   repo; nothing exists. This is a legal requirement, not a product
   preference, before collecting money from anyone.

## High — should be fixed before onboarding partner #1

4. **No alerting or monitoring push** (restated from
   `PRODUCTION_READINESS_AUDIT.md` §9). Every monitoring surface built so
   far — Error Center, audit log, system health — is pull-based. A
   stalled campaign or broken integration for a paying customer could sit
   unnoticed for however long it takes someone to think to check
   `/admin/support`.
5. **No backup strategy** (restated from `PRODUCTION_READINESS_AUDIT.md`
   §10). A real customer's real pipeline — every prospect, every reply,
   every booked meeting — depends entirely on whatever the hosting
   Supabase plan happens to provide, which has never been confirmed or
   documented as adequate.
6. **`SUPPORT_PROCESS.md` is stale against the actual support tooling.**
   It documents three feedback categories (bug/feature request/general)
   and no severity/owner/frequency triage — Phase 22 added three more
   categories (blocker, success story, onboarding friction) and a full
   triage system (severity, frequency, owner assignment) that the process
   doc never mentions. A design partner manager reading this doc to
   understand "how do we actually handle a partner's issue" would get an
   incomplete picture of the real tooling available.
7. **No response-time commitment shown to the partner themselves.** An
   internal SLA exists (`SUPPORT_PROCESS.md`: 4 business hours for
   blocking issues) but nothing in the product tells a design partner
   what to expect when they file something — they submit into a black box
   with no stated expectation.

## Medium

8. **Gmail OAuth's `state` parameter is a routing hint, not a signed CSRF
   nonce** (restated from `PRODUCTION_READINESS_AUDIT.md` §2) — not
   exploitable today because `connect_integration()`'s own authorization
   check is the real boundary, but worth hardening before partner count
   grows past a handful.
9. **Integration credentials stored unencrypted at rest** (restated,
   carried since `RELIABILITY_REPORT.md` M2).
10. **Hourly cron cadence** means up to an hour of latency on reply
    checks and campaign progression — acceptable for 5 closely-watched
    partners, worth revisiting once real usage data exists.
11. **Signup asks for a password before showing any value** (from
    `LANDING_PAGE_AUDIT.md`) — real friction, but changing the auth
    mechanism is architecture, out of scope this sprint.

## Low

12. **No explicit target-buyer statement, social proof, or pricing** on
    the signup page (from `LANDING_PAGE_AUDIT.md`) — matters far more for
    scaling cold signups than for 5 partners who'll be onboarded through a
    real conversation anyway.
13. **`scripts/test_critical_paths.sh` doesn't exhaustively cover
    migrations 001–020's RLS policies** (restated from
    `PRODUCTION_READINESS_AUDIT.md` §8) — those were verified manually in
    their own phases but aren't part of the durable, re-runnable script.

## What's genuinely ready (confirmed, not assumed)

- The full data pipeline — deploy workforce, launch campaign with a real
  ICP, find prospects, draft, approve, send, receive a reply, classify it,
  auto-create a meeting, record a deal outcome, and see it reflected in
  health scores, revenue attribution, and the executive brief — was
  validated end to end against a real Postgres 16 database this sprint
  (`CAMPAIGN_VALIDATION_REPORT.md`), 19/19 steps passing.
- RLS holds in both directions on every surface tested: 27/27 checks in
  `scripts/test_critical_paths.sh`.
- The Partner Workspace, feedback triage, customer health scoring, and
  founder dashboard (Phase 22) are real, working, and already in place —
  not missing, just not yet reflected in the stale support-process
  documentation (finding #6 above).

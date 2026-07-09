# Remaining Blockers — Before Inviting Real Design Partners

This is the honest list. Everything below is a real gap in the guided
onboarding → campaign experience built this sprint, ranked by how much it
would actually stop (or mislead) a real first-time business user. "Fixed"
elsewhere in this sprint is not repeated here — this is what's still open.

---

## Critical

### 1. "The system automatically finds prospects" is only half true
The guided campaign form accepts an Industry/Company Size/Location/ICP
description and, if no domains are pasted, asks an LLM to *suggest*
candidate company domains. This is clearly labeled "AI-suggested" in the
UI and the launch confirmation — but it is a heuristic guess, not a real
company database lookup. Hunter.io (the only prospect data provider this
platform has) enriches a *known* domain into real people; it cannot
discover companies from a description. A design partner who doesn't paste
real domains will get real, verified people — at companies an LLM merely
guessed might fit their ICP, some of which may not exist, may not fit at
all, or may already be a customer/competitor.

**Recommended fix:** integrate a real firmographic/company-discovery API
(Apollo.io, Clearbit Discovery, ZoomInfo, or Crunchbase) behind the
existing `ProspectProvider`-adjacent interface. This is new integration
surface (new credentials, likely new cost) — a deliberate scope line this
sprint didn't cross. Until then: **tell design partners to paste real
target-company domains** for anything they intend to act on; treat
AI-suggested domains as a brainstorming aid only.

### 2. Drafted emails can be reviewed but not edited in place
Phase D asked for "review email copy" before sending. The Campaign
Dashboard shows every drafted email in full before an org supervisor
approves and sends — nothing sends without that explicit click — but the
draft text itself isn't editable in the UI. If a reviewer doesn't like a
draft, the only recourse today is: don't approve it, and manually delete
the underlying task's draft data via the Tasks page before re-running
Draft Outreach (which creates a fresh draft, not an edited one).

**Recommended fix:** add an editable textarea per draft in
`DraftsReview.tsx` that updates `tasks.output.drafts[i].body` via a small
PATCH before send. Straightforward, not built this sprint due to time.

---

## High

### 3. One active campaign per organization, surfaced in the guided UI
The Campaign tab always shows the org's single "Generate Leads" goal (the
one the B2B Sales Team template creates). Power users can still create
additional goals via `/goals`, but the guided dashboard has no concept of
"campaign #2" running in parallel — launching a new campaign from the
guided flow reuses the same goal/plan lineage rather than starting a
distinct, independently trackable campaign.

**Recommended fix:** either let a design partner explicitly name and
create multiple goals from the Campaign tab (a "Campaigns" list instead
of a single dashboard), or confirm with real design partners that
one-campaign-at-a-time is actually how they'd use it before building
multi-campaign management that might not be needed.

### 4. No calendar integration — meetings are manually logged
Carried over from Phase 10, unchanged: there's no calendar/scheduling
integration, so "Meetings Booked" only increments when a human clicks "Log
a Booked Meeting." A design partner who books a meeting outside this
platform (Calendly, a calendar invite) won't see it reflected unless they
remember to log it.

**Recommended fix:** a real fix here means a real calendar integration
(Google Calendar / Calendly API) — new integration surface, out of this
sprint's scope. Document it plainly in onboarding so it isn't a surprise.

### 5. No background worker — every stage needs a human click
By design, nothing in this stack runs on a schedule: Draft Outreach,
Approve & Send, Sync to CRM, and Check Replies are all human-triggered
buttons. A design partner who launches a campaign and doesn't come back
for a week won't have leads enriched, emails sent, or replies detected in
the meantime — the campaign just sits at whatever stage it was left at.

**Recommended fix:** this is a real architectural constraint (no queue
infrastructure in this deployment), not a bug — the honest mitigation is
setting expectations during onboarding ("check back on your campaign") and
eventually adding a real job queue (Vercel Cron + a real queue, or a
Supabase Edge Function on a schedule) once there's budget for
infrastructure beyond the current Next.js-on-Supabase footprint.

### 6. Retries are inline and single-shot, not resilient to sustained outages
This sprint added one bounded retry (with backoff) for transient
429/5xx/network errors inside each request. If Gmail, Hunter, or HubSpot
is down for an extended period (not just a blip), the retry still fails
within the same request and the user sees a clear error — but there's no
queued "try again automatically once the provider recovers" mechanism.
The user must manually click the stage's button again later.

**Recommended fix:** consistent with #5 — a real retry-later mechanism
needs a job queue. Until then, the honest behavior is: fail clearly, let
the human retry, which is what's built.

---

## Medium

### 7. Agent wallets start at $0
Every agent deployed from a template starts with a $0 wallet balance
(Stabilization Sprint 1). This no longer blocks correct campaign
assignment or execution (that coupling was deliberately removed), but it
means the platform's own cost-tracking (`agent_wallet_transaction` debits)
is inactive for a design partner's organization until someone manually
funds it — a real cost-visibility gap if a design partner expects to see
spend tracked from day one.

**Recommended fix:** either seed a small starting balance during
`deploy_workforce_template()`, or add a funding step to the onboarding
wizard. A product decision, not made unilaterally this sprint.

### 8. HubSpot and Hunter connect via a pasted token, not OAuth
Unchanged from Phase 10: both integrations ask for a Private App
token / API key pasted directly into the UI, rather than an OAuth consent
flow. This is each provider's own recommended path for a single-account
integration, and is real (not simulated) — but it means a design partner
has to leave the app, generate a token in another product's settings, and
paste it back, which is more friction than Gmail's one-click OAuth.

**Recommended fix:** a HubSpot OAuth app is the natural next step for a
multi-tenant, install-from-marketplace product — meaningful new work, not
done this sprint.

### 9. Credentials are stored without column-level encryption at rest
Carried over from the due-diligence report and every phase since:
`organization_integrations.credentials` is a plain jsonb column. Treat any
pasted token like a production secret.

**Recommended fix:** encrypt this column (e.g. `pgsodium` or
application-level encryption before insert) before handling a design
partner's real, live business credentials at any real scale.

---

## Low

### 10. AI-suggested domains have no validation that the company exists
When the LLM brainstorms candidate domains (see #1), nothing checks those
domains resolve to a real, currently-operating company before Hunter
tries to enrich them — a bad suggestion just produces zero Hunter results
for that domain, which is visible but not explained as "this guess didn't
pan out" versus "Hunter has no data for this real company."

**Recommended fix:** low priority given #1 already needs a real fix; once
a real firmographic API is added, this concern mostly disappears.

### 11. Retry backoff is fixed, not provider-aware
The shared retry helper (`lib/integrations/errors.ts`) uses one backoff
curve for all three providers. A provider that returns a `Retry-After`
header (common for 429s) isn't honored — the fixed backoff might retry
too early or later than necessary.

**Recommended fix:** parse and respect `Retry-After` when present; small,
not done this sprint given its low real-world impact at current volumes.

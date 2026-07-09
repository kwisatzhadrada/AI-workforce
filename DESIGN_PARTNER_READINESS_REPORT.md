# Design Partner Readiness Report

Prepared at the close of the Design Partner Sprint. Synthesizes the user
journey review, the onboarding funnel, the support tooling, and
real-world persona testing done this sprint, plus every still-open item
carried forward from `BLOCKERS.md`. Ranked by how much each issue would
actually stop — or mislead — one of the first 3-5 real businesses using
this platform.

**The honest headline**: this platform is genuinely ready for design
partners **whose business looks like B2B sales or an agency running
outbound on behalf of clients**. It is not ready — and should not be
pitched — to a recruiter, a customer-support team, a research team, or a
content-marketing team, because only the B2B Sales vertical has any real
external-system integration behind it. That is the single most important
finding in this report, and it should shape who gets invited into the
pilot, not just what gets fixed.

---

## Critical

### 1. Only one vertical is real — every other template is a bare LLM placeholder
Verified directly against the seed data (`supabase/migrations/010_workforce_template_seeds.sql`):
zero of the Recruiting Team, Customer Support Team, Research Team, or
Content Marketing Team templates' capabilities carry an
`integration_action`. Only the B2B Sales Team's three agents (Lead
Research, Outreach, CRM) were ever wired to a real external system
(Hunter.io, Gmail, HubSpot — Phase 10). A design partner in any other
vertical would deploy a workforce that looks identical in the UI, then
discover every "execution" just produces generative text — no real
candidates, no real support tickets, no real research output.

**Recommended fix:** screen design partners for fit *before* onboarding
— confirm in the design-partner conversation that their business runs on
outbound sales/prospecting, not recruiting/support/research/content.
Don't build a second real vertical this sprint (explicitly out of
scope — "no new workforce types") — but do consider hiding or
clearly labeling the other four templates as "not yet connected to real
systems" on `/templates`, so a curious admin or a design partner who
wanders off the guided path doesn't deploy one expecting real results.

### 2. "The system automatically finds prospects" is only half true
Carried from `BLOCKERS.md` #1, still open, still Critical: the guided
campaign form's AI-suggested candidate domains are an LLM's unverified
guess, not real company data. Real, verified people only come from
Hunter.io actually enriching a domain — pasted or suggested. Tell design
partners to bring their own target-company domain list.

### 3. Drafted emails can be reviewed but not edited in place
Carried from `BLOCKERS.md` #2, still open. A supervisor can only
approve-and-send as drafted or not send at all — no in-line edit, no
regenerate button in the guided UI (see High #7 below for the closest
existing mechanism).

---

## High

### 4. No multi-organization / client-switching UX for agencies
Found this sprint via persona testing (`PERSONA_TESTING.md`): `/onboarding`
has no concept of "which of my organizations am I on right now" — it
always shows the create-new-organization form unless a specific `?org=`
is already in the URL. An agency managing multiple client accounts (the
single most likely design-partner shape for this platform, alongside
solo SaaS founders) has to fall back to the generic `/organizations`
directory to find and switch between clients — a directory built for the
original agent-network product, not styled for this use case at all.

**Recommended fix:** add an organization picker to `/onboarding` and to
the top of the Campaign tab — a simple dropdown of "my organizations,"
reusing the existing `organizations` table and `is_org_member` check;
genuinely no new architecture, just a missing piece of navigation.

### 5. Google Workspace can silently block the Gmail OAuth flow
Found this sprint via the SaaS-founder persona walkthrough: a Workspace
admin can restrict which third-party apps may request the `gmail.send`
scope for the whole domain. A founder connecting their real company
email (the likely case, not a personal Gmail) could hit a Google-side
consent-screen block that has nothing to do with this platform's code.
**Fixed partially this sprint** — now documented in `TROUBLESHOOTING.md`
and the in-app `/help/errors` page — but the underlying friction is real
and outside this platform's control; flag it proactively during design
partner onboarding rather than waiting for them to hit it.

### 6. One active campaign per organization, surfaced in the guided UI
Carried from `BLOCKERS.md` #3, still open.

### 7. No way to regenerate a bad batch of drafted outreach
Carried from `BLOCKERS.md` #7, still open — the only recourse today is
manually creating a new task outside the guided UI.

### 8. No calendar integration; No background worker
Carried from `BLOCKERS.md` #4 and #5, both still open, both structural
(would need new integration surface or job-queue infrastructure,
respectively) rather than something this sprint's scope covers.

---

## Medium

### 9. Nav clutter — **fixed this sprint**
Every signed-in user saw up to 9 flat top-level nav links; an admin saw
15, added one at a time across four sprints with no holistic review.
Collapsed this sprint into a "Workspace" dropdown (power-user pages:
Agents, Rankings, Templates, Goals, Tasks, Executions, Error Reference)
and an "Admin" dropdown (all six admin-only pages) — a design partner now
sees 4 direct nav items instead of 9. See `USER_JOURNEY_REVIEW.md` for
the full per-screen audit behind this.

### 10. "Average Deal Value" is ambiguous for an agency design partner
Found via persona testing: is it the agency's own fee, or the end
client's average sale? Both are valid interpretations of the same input
field and produce very different Estimated Pipeline Value numbers.

**Recommended fix:** a one-line clarifying caption ("your typical
contract value for closing this kind of deal") resolves this cheaply —
small enough to do without a schema change; not done this sprint given
time, flagged for the next pass.

### 11. Auto-created departments read as enterprise bloat for a solo founder
`deploy_workforce_template()` always creates all seven standard
departments (Sales, Marketing, Research, Operations, Support, Finance,
Development) regardless of company size — harmless functionally, but a
one- or two-person SaaS founder seeing a "Finance department" appear
unprompted reads as unnecessary complexity for what should feel like a
lightweight tool.

### 12. Setup Wizard and Sales Pipeline tabs are now redundant with the Campaign tab
Both tabs pre-date the guided Campaign Dashboard and now show a subset of
the same information less usefully. Not merged or removed this sprint —
a real (if small) breaking change for anyone who bookmarked either tab
directly deserves a product decision, not a unilateral cut. See
`USER_JOURNEY_REVIEW.md`.

### 13. Agent wallets start at $0; HubSpot/Hunter connect via pasted token, not OAuth; credentials stored unencrypted at rest
All three carried from `BLOCKERS.md` (#8, #9, #10), unchanged, still real,
still Medium.

---

## What shipped this sprint (in support of readiness, not against it)

- **Onboarding funnel with drop-off**, tracking the mission's exact seven
  stages (Account Created → Organization Created → Workforce Deployed →
  Integrations Connected → Campaign Created → Campaign Approved → First
  Email Sent), each counted as distinct organizations reaching that
  stage so a drop-off percentage is actually meaningful. Live at
  `/analytics`.
- **Design Partner Dashboard** — a "right now" snapshot (active
  organizations, connected integrations, active campaigns, emails sent,
  replies received, meetings booked), distinct from the historical
  funnel, also on `/analytics`.
- **Support tooling**: an in-app `/help/errors` reference (every error
  message this platform actually produces, what it means, what to do);
  `/admin/support` (search an organization, see its full chronological
  activity timeline across organization/sales/decision events in one
  feed); a one-click JSON debug export per organization (credentials
  automatically stripped) for reproducing a design partner's exact issue
  without five separate manual queries.
- **Nav simplified** from 9/15 flat links down to 4 direct items + two
  grouped dropdowns.

## Verdict

Ready to invite 3-5 design partners **whose business is B2B sales or an
outbound-running agency** — the pipeline is real, the human-approval gate
is real, the metrics are real, and the support tooling built this sprint
means a real issue can be triaged and reproduced quickly. Do not extend
an invitation on the basis of "AI Workforce Network, general purpose" —
that framing is not true yet, and Critical #1 above is the reason why.

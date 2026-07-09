# Demo Guide

How to stand up a real demo organization, workforce, and campaign for a
live walkthrough with a prospective design partner — using the real
platform against real (but low-stakes) accounts, not screenshots or
fabricated numbers. Nothing in this platform simulates fake data; a demo
here means actually running the real pipeline.

## Before the demo

You need real accounts you're comfortable sending real email from and
storing real (if just your own) contact data in:

- A Gmail account you control, added as a test user on the OAuth consent
  screen (see `DEPLOYMENT_GUIDE.md` Section 3) — your own personal or a
  dedicated demo Gmail account works.
- A free Hunter.io account (25 free searches/month is enough for a demo).
- A free HubSpot account (optional, but shows the CRM sync stage).

**Pick real target domains you have permission to research** — your own
company, a consenting colleague's company, or a small set of public
companies whose publicly-listed employees you don't mind appearing in a
demo (e.g. well-known SaaS companies with public "About" pages). Do not
demo against a real prospect list you haven't gotten consent to email —
outreach in this demo sends *real* email.

## Fast path: `scripts/seed_demo_org.sql`

Instead of clicking through onboarding every time, run
`scripts/seed_demo_org.sql` once (in the Supabase SQL editor, after
replacing `DEMO_USER_ID` with a real signed-up demo user's `auth.users.id`)
to instantly get a demo organization named "Acme Demo Co" with a full B2B
Sales Team workforce deployed and a campaign already created — the exact
same real mechanisms (`deploy_workforce_template()`, a real goal/plan/
tasks) the guided onboarding flow uses, just without the clicking. It
does **not** fabricate any business outcome data — no leads, sends,
replies, or meetings are inserted; the Research Prospect step's domains
are clearly labeled `(SAMPLE domains — replace with real target companies
before running)`. Connect real integrations for the new organization,
replace the sample domains with real ones (or clear them and use the
Campaign tab's AI-suggestion path), and you're at the same starting point
as the manual walkthrough below — just faster to reset between demos.

## Running the demo

1. Sign up for a fresh account (or use an existing demo account) — or run
   the seed script above and skip straight to step 4.
2. Click **Get Started**.
3. **Step 1:** Name the organization something clearly demo-labeled, e.g.
   "Acme Demo Co" — this avoids any confusion with a real customer
   organization later. Industry: whatever fits your target domains.
4. **Step 2:** Connect your demo Gmail, Hunter.io, and (optionally)
   HubSpot accounts.
5. **Step 3:** Launch a campaign with a real ICP description and either:
   - Paste 2-3 real domains you've chosen in advance (recommended for a
     predictable, controlled demo), or
   - Leave domains blank to show the AI-suggestion path live — be ready
     to explain, live, that these are unverified suggestions (this is
     itself a good moment to demonstrate the platform's honesty about
     what it can and can't verify).
6. Walk through all three campaign stages live:
   - **Find & Enrich Prospects** — show the real Hunter.io results appear.
   - **Draft & Send Outreach** — show the drafts, emphasize nothing has
     sent yet, then click Approve & Send and show the real email land in
     a test inbox (open the demo Gmail account's Sent folder, or send to
     an inbox you can show live).
   - **Sync to CRM** — show the contact appear in HubSpot with the
     outreach note.
7. Show the ROI dashboard update with real numbers (small numbers are
   fine and expected for a demo — don't inflate them).
8. If time allows, show **Pause/Stop Campaign**, the **Diagnostics** page
   (if the viewer is evaluating reliability/observability), and
   `/api/integrations/check-replies` genuinely finding a reply if you
   pre-arranged one.

## After the demo

Clean up: disconnect the demo integrations, or delete the demo
organization's data, per your own data-retention practice — this
platform doesn't auto-expire demo data.

## What not to do

- Don't fabricate metrics or skip straight to a "results" screen with
  invented numbers — the whole point of this platform (and this demo) is
  that the numbers are real.
- Don't demo outreach against a real, non-consenting prospect list.
- Don't claim the AI-suggested domains are verified data — say plainly
  that they're a heuristic starting point, same as `BLOCKERS.md` #1
  documents.

# User Guide

Reference for day-to-day use once you're past initial setup (see
`GETTING_STARTED.md` for first-run onboarding).

## The Campaign Dashboard

Your organization page's **Campaign** tab is the primary place you'll
work. It shows your active campaign (an organization runs one guided
campaign at a time — see `BLOCKERS.md` #3 if you need more than one) as
three sequential stages:

| Stage | What it does | Who/what does it |
|---|---|---|
| 1. Find & Enrich Prospects | Turns your target domains into real people | Lead Research Agent + Hunter.io |
| 2. Draft & Send Outreach | Drafts personalized emails, waits for your approval, then sends | Outreach Agent + your Gmail |
| 3. Sync to CRM | Creates/updates HubSpot contacts, logs outreach notes | CRM Agent + your HubSpot |

Each stage shows a status pill (Not set up / Ready / Awaiting your
approval / Done) and unlocks once its prerequisite is complete — you can't
draft outreach before prospects are found, and nothing sends before you
approve it.

### Reviewing prospects

Once Stage 1 completes, every contact found is listed with name, email,
title, and company. These are real, Hunter.io-verified contacts — not
guesses. There's no separate "approve" click for this stage since nothing
external has happened yet (no email sent, no CRM record created) — it's
pure information for you to review before continuing.

### Reviewing and sending outreach

Once you click "Draft Outreach Emails," every drafted email is shown in
full — recipient, subject, and body — before anything sends. Read them.
When you're satisfied, click **Approve & Send [N] Email(s)**. This is the
only action in the entire platform that sends real email; it requires an
explicit click from an organization supervisor and cannot be undone once
clicked.

If you're not satisfied with a draft, there's currently no in-place edit
(see `BLOCKERS.md` #2) — don't approve, and use the Tasks page to
investigate. This is a known rough edge, not a hidden limitation.

### Checking replies and logging meetings

Neither is automatic (this platform doesn't run anything on a schedule —
see `BLOCKERS.md` #5). Click **Check Replies** periodically; click **Log a
Booked Meeting** the moment a prospect confirms one.

### Pausing and stopping a campaign

**Pause** stops the underlying goal from being auto-progressed by the
manager agent's own logic without deleting anything — resume any time.
**Stop** marks the campaign as failed/ended; this is intended to be final
for that campaign (start a new one for further outreach on the same
organization).

## The ROI Dashboard

The metrics row at the top of the Campaign tab (and the standalone Sales
Pipeline tab) shows real counts — Prospects Found, Emails Sent, Replies,
Meetings Booked, Conversion Rate — pulled directly from the append-only
activity log, not a derived estimate. Set your **Average Deal Value**
once (an editable field just below the metrics) and **Estimated Pipeline
Value** updates automatically as meetings are booked
(`meetings booked × average deal value`).

## The Integrations Tab

Shows Gmail/HubSpot/Hunter.io connection status. A red "error" status
means the last real call to that provider failed — click through to see
the specific error (see `TROUBLESHOOTING.md`) and reconnect.

## The Diagnostics Page (admins only)

If you're an org admin, `/diagnostics` shows network-wide execution
history, integration connect/disconnect/error history, failures, retries,
and exactly why each agent was assigned to each task. Useful for
understanding *why* something didn't work, beyond the plain-English error
shown in the Campaign Dashboard.

## The Setup Wizard tab

A read-only checklist of what's connected/approved/run so far for this
organization — mostly superseded by the Campaign tab's own stage
indicators, kept for anyone who prefers a flat checklist view.

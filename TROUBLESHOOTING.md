# Troubleshooting

Every error message below is real text this platform actually produces —
not a hypothetical. If you see something not listed here, it's an
unhandled case; please report the exact text.

## "X is not connected for this organization"

You tried to run a stage (Research/Outreach/CRM) before connecting the
integration it needs. Go to the **Integrations** tab and connect Gmail,
Hunter.io, or HubSpot as indicated.

## "X rejected this connection's credentials (401/403) — the token may have
## been revoked or expired. Reconnect X from the Integrations tab."

The provider itself said your token/API key is no longer valid — usually
because it was revoked from the provider's own settings (e.g. Google
account permissions, a deleted HubSpot Private App, a regenerated Hunter
API key), not because of anything on this platform's end.

**Fix:** go to the Integrations tab, disconnect, and reconnect with a
fresh token/OAuth flow.

## "Gmail connection was revoked or expired — reconnect Gmail from the
## Integrations tab."

Same as above, specific to Gmail's OAuth refresh-token exchange failing.
If you previously revoked this app's access at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions),
reconnect from scratch rather than just re-clicking "Connect."

## "X rate limit or quota exceeded (429) — wait a few minutes before
## retrying, or check your X plan's usage limits."

The platform already retried once automatically with a short delay before
showing you this — a real, sustained rate limit or quota (e.g. Hunter's
free-tier monthly search limit) was hit. This is most common with
Hunter.io's free tier (25 searches/month).

**Fix:** wait, or upgrade the provider's plan. This is not a platform bug.

## "X is temporarily unavailable (5xx) — this is on their end, not yours.
## Try again shortly."

The provider (Gmail, HubSpot, or Hunter.io) returned a server error. The
platform already retried once automatically. This is genuinely an outage
on the provider's side.

**Fix:** wait and retry the stage's button again in a few minutes.

## "Could not reach X (network error) — check your connection and try
## again."

A connection-level failure (DNS, timeout, connection reset) rather than
an HTTP error response. Usually transient.

**Fix:** retry. If it persists, check whether the hosting environment
itself has outbound network access to that provider (a hosting/network
policy issue, not this codebase).

## "No target company domains found in the task title/description"

The Research Prospect step's description doesn't contain anything that
looks like a domain (`acme.com`). If you launched via the guided Campaign
form, this shouldn't happen (the platform always seeds real or
AI-suggested domains into that step) — if you see this, something in the
campaign launch didn't seed domains correctly; check the Diagnostics page
for the underlying task's description.

## "The AI could not suggest any candidate domains from this description
## — try pasting real target company domains instead"

You left the domains field blank on the campaign launch form, and no AI
provider (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`) is configured on this
deployment, or the model's response didn't contain anything
domain-shaped.

**Fix:** paste real target company domains directly instead of relying on
AI suggestion.

## "This organization has no manager agent yet — deploy the B2B Sales Team
## workforce first"

You tried to launch a campaign before Step 2 (deploy workforce) in
onboarding completed. Go back to `/onboarding` and deploy the workforce
first.

## "This real-world action has already run (or is currently running) for
## this task"

You (or someone else) already ran this exact stage for this exact task —
this platform physically prevents a duplicate send/enrich/sync on the
same task, even under a double-click or concurrent request. If you
genuinely need to redo the work, create a new task rather than
re-clicking the old one.

## "This outreach has not been approved yet — approve it before sending"

You tried to send outreach without the approval step completing first —
shouldn't happen through the normal Campaign Dashboard flow (the button
only appears after drafts exist), but could happen if calling the API
directly. Approve via the dashboard's "Approve & Send" button.

## "This outreach has already been sent"

A safety check — the same drafted batch can't be sent twice. If you need
to send more outreach, run Draft Outreach again to create a fresh task.

## Some prospects/leads found, but fewer than expected

If a domain returns zero people, either Hunter.io genuinely has no
verified contacts for that domain (common for very small companies or
personal domains), or that specific domain hit a transient error while
others in the same batch succeeded — check the task's output on the Tasks
page or `/diagnostics` for a `failed_domains` list with the specific
reason per domain. One bad domain no longer discards the rest of a batch
(fixed this sprint).

## Some CRM contacts synced, but not all

Same pattern as above, per-contact: check the task output's `failed` list
for the specific HubSpot error per contact. One failing contact no longer
blocks the rest of the batch.

## Emails sent doesn't match prospects found

Not a bug: outreach only drafts (and later sends) for leads found by a
completed Research step in the *same* campaign run — if Research partially
failed (see above) or you're looking at a second campaign, the counts
won't match 1:1. Check the Campaign Dashboard's per-stage detail, not just
the top-line metrics.

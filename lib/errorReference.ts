// The in-app version of TROUBLESHOOTING.md — every error message this
// platform actually produces, kept here as structured data so both the
// markdown doc and the /help/errors page can exist without silently
// drifting out of sync being the only failure mode (a human still has to
// update both, but at least the in-app copy reads as intentional prose
// rather than a dumped file).
export type ErrorReferenceEntry = {
  message: string
  meaning: string
  fix: string
}

export const ERROR_REFERENCE: ErrorReferenceEntry[] = [
  {
    message: '"X is not connected for this organization"',
    meaning: 'You tried to run a campaign stage before connecting the integration it needs.',
    fix: 'Go to the Integrations tab and connect Gmail, Hunter.io, or HubSpot as indicated.',
  },
  {
    message: '"X rejected this connection\'s credentials (401/403) — reconnect X from the Integrations tab."',
    meaning: 'The provider itself said your token/API key is no longer valid — usually because it was revoked from the provider\'s own settings, not anything on this platform\'s end.',
    fix: 'Go to the Integrations tab, disconnect, and reconnect with a fresh token/OAuth flow.',
  },
  {
    message: '"Gmail connection was revoked or expired — reconnect Gmail from the Integrations tab."',
    meaning: 'Gmail\'s OAuth refresh-token exchange failed — usually because access was revoked from your Google account settings.',
    fix: 'Reconnect from scratch (disconnect first) rather than just re-clicking Connect.',
  },
  {
    message: 'Google\'s consent screen shows "This app is blocked" or an admin-policy error',
    meaning: 'The Gmail account belongs to a Google Workspace domain whose admin restricts third-party apps from requesting sensitive scopes (gmail.send is one) — not a bug in this platform.',
    fix: 'The Workspace admin needs to allowlist this OAuth client (Admin Console → Security → API Controls → App Access Control), or connect a personal Gmail account instead for the pilot.',
  },
  {
    message: '"X rate limit or quota exceeded (429) — wait a few minutes before retrying."',
    meaning: 'A real, sustained rate limit or quota was hit (most common: Hunter.io\'s free-tier 25 searches/month). The platform already retried once automatically first.',
    fix: 'Wait, or upgrade the provider\'s plan. This is not a platform bug.',
  },
  {
    message: '"X is temporarily unavailable (5xx) — this is on their end, not yours."',
    meaning: 'The provider (Gmail, HubSpot, or Hunter.io) returned a server error. The platform already retried once automatically.',
    fix: 'Wait and retry the stage\'s button again in a few minutes.',
  },
  {
    message: '"Could not reach X (network error) — check your connection and try again."',
    meaning: 'A connection-level failure (DNS, timeout, connection reset) rather than an HTTP error response — usually transient.',
    fix: 'Retry. If it persists, check whether the hosting environment has outbound network access to that provider.',
  },
  {
    message: '"No target company domains found in the task title/description"',
    meaning: 'The Research Prospect step\'s description doesn\'t contain anything that looks like a domain. Shouldn\'t happen if you launched via the guided Campaign form.',
    fix: 'Check the Diagnostics page for the underlying task\'s description, or relaunch the campaign with real or AI-suggested domains.',
  },
  {
    message: '"The AI could not suggest any candidate domains from this description — try pasting real target company domains instead"',
    meaning: 'You left the domains field blank on the campaign launch form, and no AI provider is configured on this deployment (or the model\'s response didn\'t contain anything domain-shaped).',
    fix: 'Paste real target company domains directly instead of relying on AI suggestion.',
  },
  {
    message: '"This organization has no manager agent yet — deploy the B2B Sales Team workforce first"',
    meaning: 'You tried to launch a campaign before deploying a workforce.',
    fix: 'Go to /onboarding and deploy the workforce first.',
  },
  {
    message: '"This real-world action has already run (or is currently running) for this task"',
    meaning: 'This platform physically prevents a duplicate send/enrich/sync on the same task, even under a double-click or concurrent request.',
    fix: 'If you genuinely need to redo the work, create a new task rather than re-clicking the old one.',
  },
  {
    message: '"This outreach has not been approved yet — approve it before sending"',
    meaning: 'You tried to send outreach without the approval step completing first. Shouldn\'t happen through the normal Campaign Dashboard flow.',
    fix: 'Use the Campaign Dashboard\'s "Approve & Send" button, not a direct API call.',
  },
  {
    message: '"This outreach has already been sent"',
    meaning: 'A safety check — the same drafted batch can\'t be sent twice.',
    fix: 'Run Draft Outreach again to create a fresh task if you need to send more.',
  },
  {
    message: 'Some prospects/leads found, but fewer than expected',
    meaning: 'Either Hunter.io genuinely has no verified contacts for that domain, or that specific domain hit a transient error while others in the same batch succeeded.',
    fix: 'Check the task\'s output on the Tasks page or /diagnostics for a "failed_domains" list with the specific reason per domain.',
  },
  {
    message: 'Some CRM contacts synced, but not all',
    meaning: 'Same pattern as above, per-contact — one failing contact no longer blocks the rest of the batch.',
    fix: 'Check the task output\'s "failed" list for the specific HubSpot error per contact.',
  },
]

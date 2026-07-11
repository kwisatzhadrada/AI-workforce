# Security Overview

*A customer-facing summary of how your data is protected. Every claim
below reflects the actual, verified architecture of this platform — see
`PRODUCTION_READINESS_AUDIT.md` for the fuller internal audit, including
the handful of items still in progress, listed honestly at the end of
this document rather than omitted.*

## Authentication & access control

- Authentication is handled by Supabase Auth (industry-standard, backed
  by Postgres). We never see or store your raw password.
- Every database table enforces **row-level security (RLS)**: an
  organization's data — prospects, campaigns, meetings, revenue — is only
  ever visible to that organization's own members, verified by a
  reusable, automated test suite
  (`scripts/test_critical_paths.sh`) that specifically proves an
  unrelated outsider account cannot read another organization's data, in
  both directions, on every release.
- Sensitive actions (autonomy changes, campaign launches, deal outcomes,
  billing changes) are recorded in a real audit trail (`audit_log`),
  visible to your organization's own managers and admins.

## Your connected accounts

- **Gmail**: connected via Google's own OAuth consent screen — we never
  see or store your Google password, only a scoped access token you can
  revoke at any time from your Google Account settings.
- **HubSpot / Hunter.io**: connected via a token/key you provide directly;
  only your organization's managers and admins can view or change these.

## Sending safety

- Every organization has a **daily email send cap**, enforced at the
  database layer (not just the UI) before any real send happens.
- The same contact is never emailed twice by automatically re-detecting
  prior outreach to that address, across separate campaign runs.
- Every send is logged to the audit trail.

## Infrastructure

- Hosted on Vercel (application) and Supabase (database, backed by
  Postgres 16).
- Billing is handled entirely by Stripe — we never store your card
  number ourselves.
- Background jobs (reply checks, CRM sync) run through a scoped
  service-role credential used only inside one server-side route, gated
  by a secret bearer token, never reachable from a browser.

## What we're honestly still working on

We'd rather tell you this than let you assume it's already solved:

- **Integration credentials are not yet encrypted at rest** (they are
  stored as regular database values, access-restricted by the RLS rules
  above, but not additionally encrypted). Column-level encryption is a
  planned improvement.
- **Alerting is not yet push-based.** Our team currently checks
  monitoring dashboards rather than receiving automatic alerts for every
  possible failure — real-time alerting is planned.
- **An independent backup schedule outside our database provider is not
  yet in place** — we rely on our hosting provider's own backup
  capabilities today, and are adding an independent export as an
  additional safeguard.

## Reporting a security concern

If you believe you've found a security issue, contact
[SECURITY CONTACT EMAIL] directly rather than filing it as public
feedback.

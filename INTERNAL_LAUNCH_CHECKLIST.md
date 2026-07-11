# Internal Launch Checklist

*For the team, before opening the doors to real design partners or paid
customers. This is the "did we actually do it" list — each item links to
the document with the real detail.*

## Before anyone signs up for real

- [ ] Real Supabase project created and configured — see
      `DEPLOYMENT_CHECKLIST.md` §Supabase configuration.
- [ ] All 23 migrations applied to that real project, in order.
- [ ] `scripts/test_critical_paths.sh` run against a database reachable
      from this deployment (or at minimum, against a fresh local Postgres
      matching the same migration set) — 27/27 must pass.
- [ ] Real Gmail OAuth app created and published (not stuck in Testing
      mode) — see `DEPLOYMENT_CHECKLIST.md` §OAuth redirect URLs.
- [ ] Real Stripe account, live-mode keys, two Prices, webhook endpoint —
      see `DEPLOYMENT_CHECKLIST.md` §Billing.
- [ ] `NEXT_PUBLIC_SENTRY_DSN` and `ALERT_WEBHOOK_URL` set to real values
      — see `DEPLOYMENT_CHECKLIST.md` §Error monitoring & logging.
- [ ] `TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md` given a real legal review
      before being treated as final (both are explicitly marked as working
      drafts) — placeholders like `[DATE OF LAUNCH]` and `[SUPPORT EMAIL
      ADDRESS]` filled in with real values.
- [ ] An independent backup export scheduled outside the Supabase
      project itself — see `PRODUCTION_READINESS_AUDIT.md` §10. Still the
      top open item from the last sprint's audit.

## Before the first 5 design partners

- [ ] `/apply` reachable and submitting real applications — confirm by
      submitting a real test application and seeing it land in
      `/admin/applications`.
- [ ] Each approved partner has a real conversation about their daily
      send cap before their first real campaign — the default (50/day) is
      a safe starting point, not necessarily their eventual limit.
- [ ] Support process reviewed with whoever's on point for the first
      cohort — `SUPPORT_PROCESS.md`'s stated response times (4 business
      hours for blocking issues) should be something a real person can
      actually commit to at this volume.
- [ ] Founder dashboard (`/analytics`) checked to make sure it shows real
      numbers, not all zeros, before pointing partners at the product —
      an empty-looking product erodes trust fast.

## Before the first paid customer

- [ ] Full checkout → webhook → Billing tab loop tested in Stripe test
      mode at least once (see `DEPLOYMENT_CHECKLIST.md` §Billing) —
      **not yet done in this sandbox**, since no real Stripe test account
      is configured here. This must happen against a real Stripe test
      account before flipping `STRIPE_SECRET_KEY` to a live key.
  - Blocked here on real credentials; see `CAMPAIGN_VALIDATION_REPORT.md`
    for the same class of constraint applied to Gmail/Hunter/LLM calls.
- [ ] Cancel and resume both tested once for real, confirming the
      Billing tab's status updates match what Stripe itself shows.
- [ ] A failed-payment test run once (Stripe test mode has a specific
      test card for this) — confirm the organization's status correctly
      shows "Payment past due" and the audit log records
      `payment_failed`.

## Launch day

- [ ] `LAUNCH_VERDICT.md` (this sprint's `FINAL_DELIVERABLE.md` supersedes
      it — read that one first) reviewed by whoever is making the actual
      go/no-go call.
- [ ] Someone is actually watching `/admin/support` and the alert webhook
      channel for the first 48 hours.

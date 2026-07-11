# Deployment Checklist

A literal, tick-through checklist for taking this app to production —
the "am I actually ready" companion to `DEPLOYMENT_GUIDE.md` (the
narrative how-to) and `PRODUCTION_READINESS_AUDIT.md` (the deeper
findings behind several items here). Two real bugs in the deployment
docs were found and fixed while writing this checklist — see the
Supabase and Vercel sections below.

## Supabase configuration

- [ ] Project created, `NEXT_PUBLIC_SUPABASE_URL` and
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` copied into the real environment
      (Settings → API) — **not** the literal placeholder value from
      `.env.example`. (Found and fixed this sprint: this exact sandbox
      still had the placeholder URL, which is why the live campaign
      validation in `CAMPAIGN_VALIDATION_REPORT.md` could only go as far
      as the signup form.)
- [ ] All migrations `001`–`022` applied **in numeric order**, checking
      `supabase/migrations/` for the current highest number first — the
      guide previously said "001 through 013" and would have silently
      skipped every Phase 14–22 migration for a new deployer. Fixed this
      sprint.
- [ ] `service_role` key copied into `SUPABASE_SERVICE_ROLE_KEY` — required
      for the cron worker, not just "nice to have." Confirm it's the
      `service_role` key, not the `anon` key, by its length/prefix in the
      Supabase dashboard.
- [ ] Auth → URL Configuration: **Site URL** set to the real deployed
      origin (not `localhost`).
- [ ] Auth → URL Configuration: **Redirect URLs** allowlist includes
      `https://<your-domain>/auth/callback` — email confirmation links
      will fail silently (redirect rejected) without this exact entry.
- [ ] Auth → Email templates reviewed — the default Supabase template is
      functional but generic; at minimum confirm the confirmation email's
      subject/body doesn't reference a different product name.
- [ ] (Recommended before real paying customers) Auth → SMTP settings:
      configure a real SMTP provider. Supabase's built-in email sender has
      a low rate limit meant for development, not real signup volume.
- [ ] `is_admin = true` set on the founder's own `profiles` row — needed
      for `/admin/*`, `/system-health`, `/diagnostics`, `/analytics`.

## Environment variables (all environments — Vercel + local)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `NEXT_PUBLIC_APP_URL` (the real deployed URL, not `localhost`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (any random string) — both
      required for autonomous background execution to run at all
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
      (Gmail OAuth)
- [ ] At least one of `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set — without
      one, agent capabilities that call a model (drafting outreach,
      classifying replies, generating executive briefs) will fail at
      execution time
- [ ] Redeployed after adding/changing any variable — Vercel does not
      hot-reload environment variables into a running deployment

## OAuth redirect URLs

- [ ] Google Cloud Console OAuth client's **Authorized redirect URIs**
      includes exactly `https://<your-domain>/api/integrations/gmail/callback`
      — must match `GOOGLE_REDIRECT_URI` character-for-character, including
      the scheme (`https://`, not `http://`)
- [ ] Google OAuth consent screen is **Published** (not stuck in Testing
      mode with a 100-user cap) if onboarding more than a handful of test
      users
- [ ] Supabase Auth redirect URL allowlist (above) includes
      `/auth/callback` for email confirmation — this is a separate OAuth
      surface from Gmail's and is easy to forget since both flows use the
      word "callback"

## Vercel deployment

- [ ] `vercel.json`'s `crons` entry is present in the deployed build (it
      is committed to the repo, so this should be automatic — confirm in
      the Vercel dashboard's Cron Jobs tab after first deploy)
- [ ] First cron invocation observed to actually run (Vercel dashboard →
      Cron Jobs → view logs) — a misconfigured `CRON_SECRET` fails silently
      from the outside (the route just returns 401) and won't show up as
      a deploy error
- [ ] Production domain has a valid TLS certificate (Vercel handles this
      automatically for a custom domain, but confirm before advertising
      the URL — OAuth providers reject non-HTTPS redirect URIs anyway)

## Security settings

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set only as a server-side environment
      variable, never prefixed `NEXT_PUBLIC_` and never referenced from
      any client component — confirmed by code review: it is used in
      exactly one place, `lib/supabase/service.ts`, called only from
      `app/api/cron/process-jobs/route.ts`.
- [ ] `CRON_SECRET` is a real random value, not a guessable placeholder
      like `"secret"` or `"changeme"`.
- [ ] Integration credentials (`organization_integrations.credentials`)
      remain unencrypted at rest as of this sprint — a known, documented
      gap (`PRODUCTION_READINESS_AUDIT.md` §3), not a new finding, restated
      here so it isn't missed during a launch review.

## RLS policies

- [ ] `scripts/test_critical_paths.sh` run against a fresh database
      **as part of this deployment**, not just trusted from a prior run —
      it drops and recreates its own test database, so it's safe to run
      against any reachable Postgres 16+ server with `CREATE DATABASE`
      privileges. All 27 checks must pass.
- [ ] Spot-check one real cross-organization scenario manually if this is
      the first production deployment on a fresh Supabase project: sign
      up two accounts, confirm neither can see the other's organization,
      integrations, or meetings.

## Error monitoring & logging

- [ ] Error Center (`/admin/support`) checked as part of a regular
      operating routine — it is pull-based, not push-based (see
      `PRODUCTION_READINESS_AUDIT.md` §9). No external alerting exists yet;
      until it does, someone needs to actually open this page periodically.
- [ ] Vercel's own function logs (Vercel dashboard → your project →
      Logs) are the only record of an API route or cron invocation
      crashing outright (as opposed to completing and recording a
      `job_failures` row) — bookmark this, it's the one place a fully
      broken cron run would show up.

## Backup strategy

- [ ] Confirm the production Supabase project's plan includes
      point-in-time recovery (paid tiers only — the free tier does not
      have it). This is a plan setting, not something this codebase
      configures.
- [ ] Set up an independent, scheduled export (`pg_dump` or Supabase's
      own backup export) to storage outside the Supabase project itself.
      Not built by this codebase — genuinely missing today
      (`PRODUCTION_READINESS_AUDIT.md` §10) and worth doing before
      onboarding paying customers.
- [ ] Actually test a restore at least once before depending on it.

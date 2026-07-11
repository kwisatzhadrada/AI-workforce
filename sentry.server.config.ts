import * as Sentry from '@sentry/nextjs'

// No-ops safely when NEXT_PUBLIC_SENTRY_DSN is unset — this sandbox (and
// any deployment that hasn't created a Sentry project yet) never sends
// anything, but the wiring is real and correct.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})

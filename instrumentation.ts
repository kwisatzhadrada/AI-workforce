import * as Sentry from '@sentry/nextjs'

// Real error tracking (Phase 24) — see sentry.server.config.ts/
// sentry.edge.config.ts/instrumentation-client.ts for the actual
// Sentry.init() calls, all gated on NEXT_PUBLIC_SENTRY_DSN so this is a
// safe no-op until a real Sentry project is configured.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError

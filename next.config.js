/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co').hostname
  } catch {
    return 'placeholder.supabase.co'
  }
})()

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHost,
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

// Safe to apply even with no SENTRY_DSN set — Sentry's own SDK no-ops
// when unconfigured (see sentry.*.config.ts). `silent` avoids noisy
// upload logs on a deployment that hasn't set SENTRY_AUTH_TOKEN yet.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: false,
  disableLogger: true,
  automaticVercelMonitors: false,
})

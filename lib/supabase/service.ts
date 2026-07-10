import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// The one deliberate exception to this platform's "anon key + RLS
// everywhere" rule. Autonomous background execution (Phase 21) has no
// user session — auth.uid() is null — so it needs a trusted execution
// context. This client must never be imported by anything a browser can
// reach; it exists only for app/api/cron/*, which itself is gated by a
// CRON_SECRET bearer check before this client is ever created. The small,
// named allowlist of RPCs that accept a service-role caller are the only
// privileged surface this unlocks (see is_system_caller() in migration
// 021) — everything else still enforces org-membership exactly as before.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to run background jobs')
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

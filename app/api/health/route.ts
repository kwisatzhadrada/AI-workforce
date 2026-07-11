import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// A real external-monitor target (Vercel's own uptime checks, UptimeRobot,
// Better Stack, or a simple cron curl) — confirms the app is up AND can
// actually reach the database, not just that Next.js is serving requests.
export async function GET() {
  const start = Date.now()
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('workforce_templates').select('id', { count: 'exact', head: true }).limit(1)
    if (error) {
      return NextResponse.json({ status: 'error', database: 'unreachable', error: error.message }, { status: 503 })
    }
    return NextResponse.json({ status: 'ok', database: 'reachable', latency_ms: Date.now() - start }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ status: 'error', database: 'unreachable', error: err instanceof Error ? err.message : 'unknown' }, { status: 503 })
  }
}

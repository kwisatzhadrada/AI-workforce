import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runJobHandler } from '@/lib/runtime/jobHandlers'
import { Job, JobType } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Recurring maintenance jobs get (re)enqueued here rather than requiring
// a human to trigger them, or a separate scheduler per job type — one
// cron hit both schedules what's due and processes whatever's claimable.
// A job type is only (re)enqueued for an org if it has none already
// queued/running/retrying and hasn't completed one recently (per-type
// cadence below), so firing this route more often than the cadence is
// always safe — it just finds nothing new to do.
const RECURRING_CADENCE_HOURS: Partial<Record<JobType, number>> = {
  check_replies: 4,
  sync_crm: 24,
  generate_brief: 24,
  health_check: 24,
  compute_daily_rollup: 24,
  progress_campaign: 2,
}

async function scheduleRecurringJobs(supabase: ReturnType<typeof createServiceClient>) {
  const { data: orgs } = await supabase.from('organizations').select('id')
  const { data: executives } = await supabase.from('organization_executive').select('organization_id, autonomy_level')
  const autonomyByOrg = new Map((executives || []).map((e) => [e.organization_id, e.autonomy_level]))

  let scheduled = 0
  for (const org of orgs || []) {
    for (const [jobType, cadenceHours] of Object.entries(RECURRING_CADENCE_HOURS) as [JobType, number][]) {
      // progress_campaign only makes sense for organizations that have
      // opted into autonomy level 3+ ("AI chains stages together") —
      // scheduling it for everyone else would just be wasted no-ops.
      if (jobType === 'progress_campaign' && (autonomyByOrg.get(org.id) ?? 2) < 3) continue

      const since = new Date(Date.now() - cadenceHours * 60 * 60 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('job_queue')
        .select('id')
        .eq('organization_id', org.id)
        .eq('job_type', jobType)
        .or(`status.in.(queued,running,retrying),and(status.eq.completed,created_at.gte.${since})`)
        .limit(1)
        .maybeSingle()

      if (existing) continue

      await supabase.from('job_queue').insert({ organization_id: org.id, job_type: jobType, payload: {} })
      scheduled += 1
    }
  }
  return scheduled
}

async function processClaimedJobs(supabase: ReturnType<typeof createServiceClient>, limit: number) {
  const { data: claimed, error: claimError } = await supabase.rpc('claim_next_jobs_system', { p_limit: limit })
  if (claimError) throw new Error(claimError.message)

  const results: { jobId: string; status: string }[] = []

  for (const job of (claimed || []) as Job[]) {
    const { data: run } = await supabase.rpc('start_job_run_system', { p_job_id: job.id }).single()
    const runId = (run as { id: string } | null)?.id

    try {
      const { output } = await runJobHandler(supabase, job)
      await supabase.rpc('complete_job_system', { p_job_id: job.id, p_run_id: runId, p_output: output })
      results.push({ jobId: job.id, status: 'completed' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Job failed'
      await supabase.rpc('fail_job_system', { p_job_id: job.id, p_run_id: runId, p_error: message })
      results.push({ jobId: job.id, status: 'failed' })
    }
  }

  return results
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    const scheduled = await scheduleRecurringJobs(supabase)
    const processed = await processClaimedJobs(supabase, 10)
    return NextResponse.json({ scheduled, processed })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Cron run failed' }, { status: 500 })
  }
}

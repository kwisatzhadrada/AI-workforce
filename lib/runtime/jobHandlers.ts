import { SupabaseClient } from '@supabase/supabase-js'
import { checkRepliesForOrganization } from './checkReplies'
import { runAgentExecution } from './execute'
import { getCampaignState } from '@/lib/campaigns'
import { Job } from '@/lib/types'

export type JobHandlerResult = { output: Record<string, unknown> }

async function getOrgOwnerId(supabase: SupabaseClient, organizationId: string): Promise<string | null> {
  const { data } = await supabase.from('organizations').select('owner_id').eq('id', organizationId).maybeSingle()
  return data?.owner_id || null
}

// Runs a campaign stage exactly the way a human's click on RunStageButton
// or RunFullCampaignButton would — same runAgentExecution() call, same
// capability, same task — just invoked by the scheduler instead of a
// browser event. created_by is the organization's own owner: there is no
// real user in a cron-triggered request, and "on behalf of the account
// owner" is the honest, traceable choice (the audit log separately
// records that this specific action was system-triggered).
async function runStage(supabase: SupabaseClient, organizationId: string, stageKey: 'research' | 'outreach' | 'crm'): Promise<Record<string, unknown>> {
  const state = await getCampaignState(supabase, organizationId)
  const stage = state.stages.find((s) => s.key === stageKey)
  if (!stage?.task || !stage.agentId || !stage.capabilityId) {
    throw new Error(`No runnable "${stageKey}" stage found for this campaign`)
  }

  const ownerId = await getOrgOwnerId(supabase, organizationId)
  if (!ownerId) throw new Error('Organization has no owner to run this execution on behalf of')

  const { execution, error } = await runAgentExecution(supabase, {
    agentId: stage.agentId,
    createdBy: ownerId,
    taskId: stage.task.id,
    capabilityId: stage.capabilityId,
    input: { title: stage.task.title, description: stage.task.description },
  })
  if (error) throw new Error(error)
  if (execution?.status === 'failed') throw new Error(execution.error || `${stageKey} execution failed`)

  await supabase.from('tasks').update({ status: 'completed' }).eq('id', stage.task.id)
  return { stage: stageKey, executionId: execution?.id }
}

async function handleCheckReplies(supabase: SupabaseClient, organizationId: string): Promise<JobHandlerResult> {
  const result = await checkRepliesForOrganization(supabase, organizationId)
  if (result.error) throw new Error(result.error)
  return { output: { ...result } }
}

async function handleSyncCrm(supabase: SupabaseClient, organizationId: string): Promise<JobHandlerResult> {
  const output = await runStage(supabase, organizationId, 'crm')
  return { output }
}

// The autonomous equivalent of "Run Full Campaign" (autonomy level 3+):
// research then draft, in sequence, without a human clicking either.
async function handleProgressCampaign(supabase: SupabaseClient, organizationId: string): Promise<JobHandlerResult> {
  const { data: executive } = await supabase.from('organization_executive').select('autonomy_level').eq('organization_id', organizationId).maybeSingle()
  if (!executive || executive.autonomy_level < 3) {
    return { output: { skipped: 'autonomy level below 3' } }
  }

  const state = await getCampaignState(supabase, organizationId)
  const research = state.stages.find((s) => s.key === 'research')
  const outreach = state.stages.find((s) => s.key === 'outreach')
  const researchDone = Array.isArray(research?.task?.output?.leads) && (research!.task!.output!.leads as unknown[]).length > 0
  const outreachDrafted = Array.isArray(outreach?.task?.output?.drafts) && (outreach!.task!.output!.drafts as unknown[]).length > 0

  const results: Record<string, unknown> = {}
  if (!researchDone) {
    results.research = await runStage(supabase, organizationId, 'research')
  } else if (!outreachDrafted) {
    results.outreach = await runStage(supabase, organizationId, 'outreach')
  } else {
    return { output: { skipped: 'campaign already fully progressed for this cycle' } }
  }
  return { output: results }
}

async function handleGenerateBrief(supabase: SupabaseClient, organizationId: string, payload: Record<string, unknown>): Promise<JobHandlerResult> {
  const periodType = (payload.period_type as string) || 'daily'
  const { data, error } = await supabase.rpc('generate_executive_brief', { p_org_id: organizationId, p_period_type: periodType })
  if (error) throw new Error(error.message)
  return { output: { briefId: data?.id } }
}

// Auto-conclude a running subject-line test once it has enough real
// volume to trust — a fixed, documented threshold (20 sends per
// variant), not a guess at "when is this statistically significant."
const MIN_SENDS_PER_VARIANT_TO_CONCLUDE = 20

// No FK links experiment_assignments to sales_activities (they're joined
// only by contact_email), so this is two plain queries per variant, not
// a PostgREST embed — fetch who was assigned, then count how many of
// them actually got a real email_sent.
async function countRealSends(supabase: SupabaseClient, organizationId: string, experimentId: string, variant: 'a' | 'b'): Promise<number> {
  const { data: assignments } = await supabase
    .from('experiment_assignments')
    .select('contact_email')
    .eq('experiment_id', experimentId)
    .eq('variant', variant)
  const emails = (assignments || []).map((a) => a.contact_email)
  if (emails.length === 0) return 0

  const { count } = await supabase
    .from('sales_activities')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('activity_type', 'email_sent')
    .in('contact_email', emails)
  return count || 0
}

async function handleEvaluateExperiment(supabase: SupabaseClient, organizationId: string): Promise<JobHandlerResult> {
  const { data: experiments } = await supabase.from('experiments').select('id').eq('organization_id', organizationId).eq('status', 'running')
  const concluded: string[] = []

  for (const exp of experiments || []) {
    const aSent = await countRealSends(supabase, organizationId, exp.id, 'a')
    const bSent = await countRealSends(supabase, organizationId, exp.id, 'b')

    if (aSent >= MIN_SENDS_PER_VARIANT_TO_CONCLUDE && bSent >= MIN_SENDS_PER_VARIANT_TO_CONCLUDE) {
      await supabase.rpc('conclude_experiment', { p_experiment_id: exp.id })
      concluded.push(exp.id)
    }
  }

  return { output: { concluded } }
}

async function handleHealthCheck(supabase: SupabaseClient, organizationId: string): Promise<JobHandlerResult> {
  const { data, error } = await supabase.rpc('get_organization_health', { p_org_id: organizationId }).single()
  if (error) throw new Error(error.message)
  return { output: (data as Record<string, unknown>) || {} }
}

async function handleComputeDailyRollup(supabase: SupabaseClient, organizationId: string): Promise<JobHandlerResult> {
  const today = new Date().toISOString().slice(0, 10)
  const dayStart = `${today}T00:00:00.000Z`

  const { data: activities } = await supabase
    .from('sales_activities')
    .select('activity_type')
    .eq('organization_id', organizationId)
    .gte('created_at', dayStart)

  const counts = { leads_found: 0, emails_sent: 0, replies_received: 0, meetings_booked: 0 }
  for (const a of activities || []) {
    if (a.activity_type === 'lead_found') counts.leads_found += 1
    if (a.activity_type === 'email_sent') counts.emails_sent += 1
    if (a.activity_type === 'reply_received') counts.replies_received += 1
    if (a.activity_type === 'meeting_booked') counts.meetings_booked += 1
  }

  await supabase.from('organization_metrics_daily').upsert(
    { organization_id: organizationId, metric_date: today, ...counts },
    { onConflict: 'organization_id,metric_date' }
  )

  return { output: counts }
}

export async function runJobHandler(supabase: SupabaseClient, job: Job): Promise<JobHandlerResult> {
  if (!job.organization_id) throw new Error('Job has no organization_id')

  switch (job.job_type) {
    case 'check_replies': return handleCheckReplies(supabase, job.organization_id)
    case 'sync_crm': return handleSyncCrm(supabase, job.organization_id)
    case 'progress_campaign': return handleProgressCampaign(supabase, job.organization_id)
    case 'generate_brief': return handleGenerateBrief(supabase, job.organization_id, job.payload)
    case 'evaluate_experiment': return handleEvaluateExperiment(supabase, job.organization_id)
    case 'health_check': return handleHealthCheck(supabase, job.organization_id)
    case 'compute_daily_rollup': return handleComputeDailyRollup(supabase, job.organization_id)
    default: throw new Error(`Unknown job_type: ${job.job_type}`)
  }
}

import { SupabaseClient } from '@supabase/supabase-js'
import { getAgentActivitySummary, getSalesMetrics, getOrganizationIntegrations } from './sales'
import { getEmailQueue, getProspectPipeline, getCampaignCost } from './campaigns'
import { AgentActivitySummary, EmailQueue, ProspectPipeline, SalesMetrics } from './types'

export type TodayActivity = {
  leadsFound: number
  emailsSent: number
  repliesReceived: number
  meetingsBooked: number
}

export type BusinessDashboardData = {
  metrics: SalesMetrics | null
  pipeline: ProspectPipeline | null
  emailQueue: EmailQueue | null
  costEstimate: number
  agentActivity: AgentActivitySummary[]
  today: TodayActivity
  pendingApproval: number
  hubspotConnected: boolean
  gmailConnected: boolean
  hunterConnected: boolean
  recommendations: string[]
}

// Everything here reads data that already exists — no new tables, no new
// RPC beyond the read-only aggregations added this sprint. CEO Mode is
// the same bundle rendered with fewer fields, not a second fetch.
export async function getBusinessDashboardData(supabase: SupabaseClient, organizationId: string): Promise<BusinessDashboardData> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [metrics, pipeline, emailQueue, costEstimate, agentActivity, integrations, todayResult] = await Promise.all([
    getSalesMetrics(supabase, organizationId),
    getProspectPipeline(supabase, organizationId),
    getEmailQueue(supabase, organizationId),
    getCampaignCost(supabase, organizationId),
    getAgentActivitySummary(supabase, organizationId),
    getOrganizationIntegrations(supabase, organizationId),
    supabase.from('sales_activities').select('activity_type').eq('organization_id', organizationId).gte('created_at', since),
  ])

  const today: TodayActivity = { leadsFound: 0, emailsSent: 0, repliesReceived: 0, meetingsBooked: 0 }
  for (const row of (todayResult.data as { activity_type: string }[]) || []) {
    if (row.activity_type === 'lead_found') today.leadsFound += 1
    if (row.activity_type === 'email_sent') today.emailsSent += 1
    if (row.activity_type === 'reply_received') today.repliesReceived += 1
    if (row.activity_type === 'meeting_booked') today.meetingsBooked += 1
  }

  const connected = new Set(integrations.filter((i) => i.status === 'connected').map((i) => i.provider))
  const hubspotConnected = connected.has('hubspot')
  const gmailConnected = connected.has('gmail')
  const hunterConnected = connected.has('hunter')

  const recommendations: string[] = []
  if (!gmailConnected) recommendations.push('Connect Gmail to start sending real outreach.')
  if (!hunterConnected) recommendations.push('Connect Hunter.io to find real prospects.')
  if (!hubspotConnected) recommendations.push('Connect HubSpot to keep your CRM automatically up to date.')
  if (metrics && metrics.emails_sent > 0 && metrics.reply_rate < 5) {
    recommendations.push('Reply rate is under 5% — expand or refine your ICP targeting.')
  }
  if (pipeline && pipeline.enriched > 0 && emailQueue && emailQueue.sent === 0) {
    recommendations.push('You have prospects waiting — draft and approve outreach to start converting them.')
  }
  if (metrics && metrics.emails_sent > 0 && metrics.reply_rate >= 10) {
    recommendations.push('Reply rate is strong — consider increasing daily send volume.')
  }
  if (recommendations.length === 0) recommendations.push('Everything looks healthy — no action needed right now.')

  return {
    metrics, pipeline, emailQueue, costEstimate, agentActivity, today,
    pendingApproval: emailQueue?.pending_approval || 0,
    hubspotConnected, gmailConnected, hunterConnected,
    recommendations,
  }
}

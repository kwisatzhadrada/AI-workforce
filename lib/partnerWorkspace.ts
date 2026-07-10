import { SupabaseClient } from '@supabase/supabase-js'
import { getOrganizationIntegrations } from './sales'
import { getMeetings } from './meetings'
import { PartnerWorkspaceData, SuccessChecklistItem } from './types'

// The one page a design partner should need day-to-day: onboarding
// progress, integration status, campaign status, meetings booked, and
// support status, all in business language. Every field here reads data
// that already exists elsewhere (integrations, the campaign goal, sales
// activities, meetings, support conversations) — nothing new is written,
// nothing here introduces a new concept, and no "agent"/"workflow"/
// "task" terminology appears in any label.
export async function getPartnerWorkspaceData(supabase: SupabaseClient, organizationId: string): Promise<PartnerWorkspaceData> {
  const [integrations, meetings, { data: goal }, { count: firstReplyCount }, { count: openSupportCount }] = await Promise.all([
    getOrganizationIntegrations(supabase, organizationId),
    getMeetings(supabase, organizationId),
    supabase
      .from('organization_goals')
      .select('id, status, is_paused, target_metrics')
      .eq('organization_id', organizationId)
      .eq('title', 'Generate Leads')
      .maybeSingle(),
    supabase
      .from('sales_activities')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('activity_type', 'reply_received'),
    supabase
      .from('support_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .not('status', 'in', '(resolved,closed)'),
  ])

  const connected = new Set(integrations.filter((i) => i.status === 'connected').map((i) => i.provider))
  const icpDefined = !!(goal?.target_metrics as { icp?: { targetIndustry?: string | null } } | null)?.icp?.targetIndustry
  const hasMeeting = meetings.length > 0
  const hasOpportunity = meetings.some((m) => m.status === 'scheduled' || m.status === 'completed')

  const campaignStatus: PartnerWorkspaceData['campaignStatus'] = !goal
    ? 'not_started'
    : goal.status === 'completed'
    ? 'completed'
    : goal.is_paused
    ? 'paused'
    : 'active'

  const checklist: SuccessChecklistItem[] = [
    { key: 'gmail', label: 'Connect Gmail', done: connected.has('gmail') },
    { key: 'crm', label: 'Connect CRM', done: connected.has('hubspot') },
    { key: 'icp', label: 'Define ICP', done: icpDefined },
    { key: 'campaign', label: 'Launch Campaign', done: !!goal },
    { key: 'reply', label: 'First Reply', done: (firstReplyCount || 0) > 0 },
    { key: 'meeting', label: 'First Meeting', done: hasMeeting },
    { key: 'opportunity', label: 'First Opportunity', done: hasOpportunity },
  ]

  return {
    checklist,
    completedCount: checklist.filter((c) => c.done).length,
    totalCount: checklist.length,
    integrations: integrations.map((i) => ({ provider: i.provider, status: i.status })),
    campaignStatus,
    meetingsBooked: meetings.length,
    openSupportConversations: openSupportCount || 0,
  }
}

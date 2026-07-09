import { SupabaseClient } from '@supabase/supabase-js'
import { AgentActivitySummary, IntegrationProvider, OrganizationIntegration, SalesActivity, SalesActivityType, SalesMetrics } from './types'

export async function getOrganizationIntegrations(supabase: SupabaseClient, organizationId: string): Promise<OrganizationIntegration[]> {
  const { data } = await supabase.from('organization_integrations').select('*').eq('organization_id', organizationId)
  return (data as OrganizationIntegration[]) || []
}

export async function connectHubSpot(supabase: SupabaseClient, organizationId: string, accessToken: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('connect_integration', {
    p_org_id: organizationId,
    p_provider: 'hubspot',
    p_credentials: { accessToken },
  })
  return { error: error?.message || null }
}

export async function connectHunter(supabase: SupabaseClient, organizationId: string, apiKey: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('connect_integration', {
    p_org_id: organizationId,
    p_provider: 'hunter',
    p_credentials: { apiKey },
  })
  return { error: error?.message || null }
}

export async function disconnectIntegration(supabase: SupabaseClient, organizationId: string, provider: IntegrationProvider): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('disconnect_integration', { p_org_id: organizationId, p_provider: provider })
  return { error: error?.message || null }
}

export async function getSalesMetrics(supabase: SupabaseClient, organizationId: string): Promise<SalesMetrics | null> {
  const { data, error } = await supabase.rpc('get_sales_metrics', { p_org_id: organizationId }).single()
  if (error || !data) return null
  return data as SalesMetrics
}

export async function getSalesActivity(supabase: SupabaseClient, organizationId: string, limit = 50): Promise<SalesActivity[]> {
  const { data } = await supabase
    .from('sales_activities')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as SalesActivity[]) || []
}

export async function setAvgDealValue(supabase: SupabaseClient, organizationId: string, value: number | null): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_avg_deal_value', { p_org_id: organizationId, p_value: value })
  return { error: error?.message || null }
}

// "Research Agent found 87 leads" needs to be a plain count per agent per
// activity type — aggregated here in TS from the raw sales_activities
// ledger (same "small dataset, simple client-side groupby" pattern the
// org page's Tasks tab already uses for agent/department counts) rather
// than a new SQL function for what's a one-time read.
export async function getAgentActivitySummary(supabase: SupabaseClient, organizationId: string): Promise<AgentActivitySummary[]> {
  const { data } = await supabase
    .from('sales_activities')
    .select('agent_id, activity_type, agents(name)')
    .eq('organization_id', organizationId)
    .not('agent_id', 'is', null)

  const rows = (data as unknown as { agent_id: string; activity_type: SalesActivityType; agents: { name: string } | null }[]) || []
  const counts = new Map<string, AgentActivitySummary>()
  for (const row of rows) {
    if (!row.agent_id) continue
    const key = `${row.agent_id}:${row.activity_type}`
    const existing = counts.get(key)
    if (existing) existing.count += 1
    else counts.set(key, { agentId: row.agent_id, agentName: row.agents?.name || 'Agent', activityType: row.activity_type, count: 1 })
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count)
}

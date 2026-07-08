import { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationProvider, OrganizationIntegration, SalesActivity, SalesMetrics } from './types'

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

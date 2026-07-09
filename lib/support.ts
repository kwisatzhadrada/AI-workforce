import { SupabaseClient } from '@supabase/supabase-js'
import { OrganizationTimelineEvent } from './types'

export async function getOrganizationDebugExport(supabase: SupabaseClient, organizationId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('get_organization_debug_export', { p_org_id: organizationId })
  if (error || !data) return null
  return data as Record<string, unknown>
}

export async function getOrganizationTimeline(supabase: SupabaseClient, organizationId: string, limit = 100): Promise<OrganizationTimelineEvent[]> {
  const { data } = await supabase.rpc('get_organization_timeline', { p_org_id: organizationId, p_limit: limit })
  return (data as OrganizationTimelineEvent[]) || []
}

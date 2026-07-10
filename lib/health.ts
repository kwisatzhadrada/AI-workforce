import { SupabaseClient } from '@supabase/supabase-js'
import { BusinessOutcomes, CustomerHealth } from './types'

export async function getOrganizationHealth(supabase: SupabaseClient, organizationId: string): Promise<CustomerHealth | null> {
  const { data, error } = await supabase.rpc('get_organization_health', { p_org_id: organizationId }).single()
  if (error || !data) return null
  return data as CustomerHealth
}

export async function getBusinessOutcomes(supabase: SupabaseClient, organizationId: string): Promise<BusinessOutcomes | null> {
  const { data, error } = await supabase.rpc('get_business_outcomes', { p_org_id: organizationId }).single()
  if (error || !data) return null
  return data as BusinessOutcomes
}

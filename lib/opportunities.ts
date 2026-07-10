import { SupabaseClient } from '@supabase/supabase-js'
import { Opportunities } from './types'

export async function getOpportunities(supabase: SupabaseClient, organizationId: string): Promise<Opportunities | null> {
  const { data, error } = await supabase.rpc('get_opportunities', { p_org_id: organizationId })
  if (error || !data) return null
  return data as Opportunities
}

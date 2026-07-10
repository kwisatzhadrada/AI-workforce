import { SupabaseClient } from '@supabase/supabase-js'
import { JourneyMilestone } from './types'

export async function getOrganizationJourney(supabase: SupabaseClient, organizationId: string): Promise<JourneyMilestone[]> {
  const { data } = await supabase.rpc('get_organization_journey', { p_org_id: organizationId })
  return (data as JourneyMilestone[]) || []
}

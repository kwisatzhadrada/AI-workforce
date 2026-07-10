import { SupabaseClient } from '@supabase/supabase-js'
import { ExecutiveBrief, ExecutiveBriefPeriod } from './types'

export async function generateExecutiveBrief(
  supabase: SupabaseClient, organizationId: string, periodType: ExecutiveBriefPeriod
): Promise<{ brief: ExecutiveBrief | null; error: string | null }> {
  const { data, error } = await supabase.rpc('generate_executive_brief', { p_org_id: organizationId, p_period_type: periodType })
  if (error) return { brief: null, error: error.message }
  return { brief: data as ExecutiveBrief, error: null }
}

export async function getExecutiveBriefs(supabase: SupabaseClient, organizationId: string, periodType?: ExecutiveBriefPeriod): Promise<ExecutiveBrief[]> {
  let query = supabase.from('executive_briefs').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
  if (periodType) query = query.eq('period_type', periodType)
  const { data } = await query
  return (data as ExecutiveBrief[]) || []
}

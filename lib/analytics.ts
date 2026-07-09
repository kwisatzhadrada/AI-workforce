import { SupabaseClient } from '@supabase/supabase-js'
import { AnalyticsByOrganization, AnalyticsFunnel } from './types'

export async function getAnalyticsFunnel(supabase: SupabaseClient): Promise<AnalyticsFunnel | null> {
  const { data, error } = await supabase.rpc('get_analytics_funnel').single()
  if (error || !data) return null
  return data as AnalyticsFunnel
}

export async function getAnalyticsByOrganization(supabase: SupabaseClient): Promise<AnalyticsByOrganization[]> {
  const { data } = await supabase.rpc('get_analytics_by_organization')
  return (data as AnalyticsByOrganization[]) || []
}

import { SupabaseClient } from '@supabase/supabase-js'
import { AnalyticsByOrganization, AnalyticsFunnel, OnboardingFunnel, PlatformOverview } from './types'

export async function getAnalyticsFunnel(supabase: SupabaseClient): Promise<AnalyticsFunnel | null> {
  const { data, error } = await supabase.rpc('get_analytics_funnel').single()
  if (error || !data) return null
  return data as AnalyticsFunnel
}

export async function getAnalyticsByOrganization(supabase: SupabaseClient): Promise<AnalyticsByOrganization[]> {
  const { data } = await supabase.rpc('get_analytics_by_organization')
  return (data as AnalyticsByOrganization[]) || []
}

export async function getOnboardingFunnel(supabase: SupabaseClient): Promise<OnboardingFunnel | null> {
  const { data, error } = await supabase.rpc('get_onboarding_funnel').single()
  if (error || !data) return null
  return data as OnboardingFunnel
}

export async function getPlatformOverview(supabase: SupabaseClient): Promise<PlatformOverview | null> {
  const { data, error } = await supabase.rpc('get_platform_overview').single()
  if (error || !data) return null
  return data as PlatformOverview
}

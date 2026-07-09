import { SupabaseClient } from '@supabase/supabase-js'
import { AnalyticsByOrganization, AnalyticsFunnel, OnboardingFunnel, PlatformOverview, ProductAnalyticsFunnel } from './types'

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

// The exact stage set this sprint's mission asked for (signup through
// first meeting booked) — kept alongside get_onboarding_funnel (which
// tracks a different, earlier-stage funnel: profile -> org -> integration
// -> deploy -> campaign) rather than replacing it, since the two answer
// different questions and neither is a strict subset of the other.
export async function getProductAnalyticsFunnel(supabase: SupabaseClient): Promise<ProductAnalyticsFunnel | null> {
  const { data, error } = await supabase.rpc('get_product_analytics_funnel').single()
  if (error || !data) return null
  return data as ProductAnalyticsFunnel
}

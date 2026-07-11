import { SupabaseClient } from '@supabase/supabase-js'
import { OrganizationBillingStatus, SendEligibility } from './types'

export async function getOrganizationBillingStatus(supabase: SupabaseClient, organizationId: string): Promise<OrganizationBillingStatus | null> {
  const { data, error } = await supabase.rpc('get_organization_billing_status', { p_org_id: organizationId }).single()
  if (error || !data) return null
  return data as OrganizationBillingStatus
}

export async function checkSendEligibility(supabase: SupabaseClient, organizationId: string, count: number): Promise<SendEligibility | null> {
  const { data, error } = await supabase.rpc('check_send_eligibility', { p_org_id: organizationId, p_count: count }).single()
  if (error || !data) return null
  return data as SendEligibility
}

export async function setDailySendCap(supabase: SupabaseClient, organizationId: string, cap: number): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_daily_send_cap', { p_org_id: organizationId, p_cap: cap })
  return { error: error?.message || null }
}

export async function setSubscriptionComped(supabase: SupabaseClient, organizationId: string, comped: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_subscription_comped', { p_org_id: organizationId, p_comped: comped })
  return { error: error?.message || null }
}

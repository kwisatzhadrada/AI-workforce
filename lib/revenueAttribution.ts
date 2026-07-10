import { SupabaseClient } from '@supabase/supabase-js'
import { DealOutcome, Meeting, RevenueAttribution } from './types'

// Distinct from lib/revenue.ts: that file tracks OUR platform's own
// subscription revenue from design partners (admin-only). This tracks a
// design partner's OWN campaign revenue — a meeting becoming a real won
// or lost deal, entered by a human, the same way estimated_value already is.
export async function recordDealOutcome(
  supabase: SupabaseClient,
  meetingId: string,
  outcome: DealOutcome,
  value?: number | null
): Promise<{ meeting: Meeting | null; error: string | null }> {
  const { data, error } = await supabase.rpc('record_deal_outcome', { p_meeting_id: meetingId, p_outcome: outcome, p_value: value ?? null })
  if (error) return { meeting: null, error: error.message }
  return { meeting: data as Meeting, error: null }
}

export async function getRevenueAttribution(supabase: SupabaseClient, organizationId: string): Promise<RevenueAttribution | null> {
  const { data, error } = await supabase.rpc('get_revenue_attribution', { p_org_id: organizationId })
  if (error || !data) return null
  return data as RevenueAttribution
}

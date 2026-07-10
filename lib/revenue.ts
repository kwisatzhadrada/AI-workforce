import { SupabaseClient } from '@supabase/supabase-js'
import { RevenueEvent, RevenueEventType, RevenueMetrics } from './types'

// Admin-only, manually-logged real business facts — not a payment
// gateway. An admin tells the system "this design partner started
// paying us $X/mo today," the same pattern meetings/avg_deal_value
// already established, rather than automated billing infrastructure.
export async function recordRevenueEvent(
  supabase: SupabaseClient,
  params: { organizationId: string; eventType: RevenueEventType; amount?: number | null; notes?: string | null }
): Promise<{ event: RevenueEvent | null; error: string | null }> {
  const { data, error } = await supabase.rpc('record_revenue_event', {
    p_org_id: params.organizationId,
    p_event_type: params.eventType,
    p_amount: params.amount ?? null,
    p_notes: params.notes ?? null,
  })
  if (error) return { event: null, error: error.message }
  return { event: data as RevenueEvent, error: null }
}

export async function getRevenueEvents(supabase: SupabaseClient, organizationId?: string): Promise<RevenueEvent[]> {
  let query = supabase.from('revenue_events').select('*, organizations(id, name)').order('created_at', { ascending: false })
  if (organizationId) query = query.eq('organization_id', organizationId)
  const { data } = await query
  return (data as RevenueEvent[]) || []
}

export async function getRevenueMetrics(supabase: SupabaseClient): Promise<RevenueMetrics | null> {
  const { data, error } = await supabase.rpc('get_revenue_metrics').single()
  if (error || !data) return null
  return data as RevenueMetrics
}

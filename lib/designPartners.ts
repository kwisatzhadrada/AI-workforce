import { SupabaseClient } from '@supabase/supabase-js'
import { DesignPartner, DesignPartnerCohortRow, DesignPartnerStatus } from './types'

// Admin-only internal CRM. RLS on design_partners already gates every
// select/insert/update/delete on is_admin() (migration 018) — no RPC
// layer needed, matching the system_reports precedent (Phase 8) of plain
// admin-only RLS over direct table access.
export async function getDesignPartners(supabase: SupabaseClient): Promise<DesignPartner[]> {
  const { data } = await supabase
    .from('design_partners')
    .select('*, organizations(id, name, industry, company_size)')
    .order('created_at', { ascending: false })
  return (data as DesignPartner[]) || []
}

export async function getDesignPartner(supabase: SupabaseClient, organizationId: string): Promise<DesignPartner | null> {
  const { data } = await supabase.from('design_partners').select('*, organizations(id, name, industry, company_size)').eq('organization_id', organizationId).maybeSingle()
  return (data as DesignPartner) || null
}

export async function upsertDesignPartner(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    contactName?: string | null
    contactEmail?: string | null
    contactRole?: string | null
    status?: DesignPartnerStatus
    satisfactionScore?: number | null
    requestedFeatures?: string | null
    feedbackNotes?: string | null
    meetingNotes?: string | null
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('design_partners').upsert(
    {
      organization_id: params.organizationId,
      contact_name: params.contactName ?? null,
      contact_email: params.contactEmail ?? null,
      contact_role: params.contactRole ?? null,
      status: params.status ?? 'prospect',
      satisfaction_score: params.satisfactionScore ?? null,
      requested_features: params.requestedFeatures ?? null,
      feedback_notes: params.feedbackNotes ?? null,
      meeting_notes: params.meetingNotes ?? null,
    },
    { onConflict: 'organization_id' }
  )
  return { error: error?.message || null }
}

export async function deleteDesignPartner(supabase: SupabaseClient, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('design_partners').delete().eq('id', id)
  return { error: error?.message || null }
}

export async function getDesignPartnerCohort(supabase: SupabaseClient): Promise<DesignPartnerCohortRow[]> {
  const { data } = await supabase.rpc('get_design_partner_cohort')
  return (data as DesignPartnerCohortRow[]) || []
}

import { SupabaseClient } from '@supabase/supabase-js'
import { DesignPartnerApplication, DesignPartnerApplicationStatus } from './types'

// The one legitimate anon-reachable write in this schema — a prospective
// design partner applies before they have an account at all.
export async function submitDesignPartnerApplication(
  supabase: SupabaseClient,
  params: {
    companyName: string
    industry: string
    teamSize: string
    currentSalesProcess: string
    goals: string
    contactName: string
    contactEmail: string
    contactRole?: string | null
  }
): Promise<{ application: DesignPartnerApplication | null; error: string | null }> {
  const { data, error } = await supabase.rpc('submit_design_partner_application', {
    p_company_name: params.companyName,
    p_industry: params.industry,
    p_team_size: params.teamSize,
    p_current_sales_process: params.currentSalesProcess,
    p_goals: params.goals,
    p_contact_name: params.contactName,
    p_contact_email: params.contactEmail,
    p_contact_role: params.contactRole || null,
  })
  if (error) return { application: null, error: error.message }
  return { application: data as DesignPartnerApplication, error: null }
}

export async function getDesignPartnerApplications(supabase: SupabaseClient): Promise<DesignPartnerApplication[]> {
  const { data } = await supabase.from('design_partner_applications').select('*').order('created_at', { ascending: false })
  return (data as DesignPartnerApplication[]) || []
}

export async function reviewDesignPartnerApplication(
  supabase: SupabaseClient,
  applicationId: string,
  status: DesignPartnerApplicationStatus,
  notes?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('review_design_partner_application', {
    p_application_id: applicationId,
    p_status: status,
    p_notes: notes || null,
  })
  return { error: error?.message || null }
}

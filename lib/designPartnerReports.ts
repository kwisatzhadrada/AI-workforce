import { SupabaseClient } from '@supabase/supabase-js'
import { DesignPartnerReport } from './types'

export async function generateDesignPartnerReport(supabase: SupabaseClient, organizationId: string): Promise<{ report: DesignPartnerReport | null; error: string | null }> {
  const { data, error } = await supabase.rpc('generate_design_partner_report', { p_org_id: organizationId })
  if (error) return { report: null, error: error.message }
  return { report: data as DesignPartnerReport, error: null }
}

export async function getDesignPartnerReports(supabase: SupabaseClient, organizationId: string): Promise<DesignPartnerReport[]> {
  const { data } = await supabase
    .from('design_partner_reports')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  return (data as DesignPartnerReport[]) || []
}

import { SupabaseClient } from '@supabase/supabase-js'
import { OrganizationReport, OrganizationReportType } from './types'

export async function generateOrganizationReport(
  supabase: SupabaseClient,
  organizationId: string,
  reportType: OrganizationReportType
): Promise<{ report: OrganizationReport | null; error: string | null }> {
  const { data, error } = await supabase.rpc('generate_organization_report', {
    p_org_id: organizationId,
    p_report_type: reportType,
  })
  if (error) return { report: null, error: error.message }
  return { report: data as OrganizationReport, error: null }
}

export async function getOrganizationReports(supabase: SupabaseClient, organizationId: string): Promise<OrganizationReport[]> {
  const { data } = await supabase
    .from('organization_reports')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  return (data as OrganizationReport[]) || []
}

export async function getOrganizationReport(supabase: SupabaseClient, reportId: string): Promise<OrganizationReport | null> {
  const { data } = await supabase.from('organization_reports').select('*').eq('id', reportId).maybeSingle()
  return (data as OrganizationReport) || null
}

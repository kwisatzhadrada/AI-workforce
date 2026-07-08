import { SupabaseClient } from '@supabase/supabase-js'
import { TemplateMetrics } from './types'

export async function deployTemplate(
  supabase: SupabaseClient,
  templateId: string,
  organizationName: string,
  industry?: string
): Promise<{ organizationId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('deploy_workforce_template', {
    p_template_id: templateId,
    p_organization_name: organizationName,
    p_industry: industry || null,
  })

  if (error) {
    // The failed attempt's own transaction rolled back entirely (including
    // any org it half-created), so the failure is logged in a fresh call.
    await supabase.rpc('log_failed_deployment', { p_template_id: templateId, p_error: error.message })
    return { organizationId: null, error: error.message }
  }

  return { organizationId: data as string, error: null }
}

export async function getTemplateMetrics(supabase: SupabaseClient, templateId: string): Promise<TemplateMetrics | null> {
  const { data, error } = await supabase.rpc('get_template_metrics', { p_template_id: templateId }).single()
  if (error || !data) return null
  return data as TemplateMetrics
}

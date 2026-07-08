import { SupabaseClient } from '@supabase/supabase-js'
import {
  AgentCareer,
  AgentComparison,
  AgentProfileIntelligence,
  AnomalyReport,
  OrganizationComparison,
  OrganizationHealth,
  RankedAgent,
  RankedOrganization,
  RankedTemplate,
  RankedWorkflow,
  ReportType,
  SystemReport,
  WorkflowComparison,
  WorkflowIntelligence,
  WorkforcePrediction,
  WorkforceRecommendation,
} from './types'

export async function getAgentIntelligence(supabase: SupabaseClient, agentId: string): Promise<AgentProfileIntelligence | null> {
  const { data } = await supabase.from('agent_profiles_intelligence').select('*').eq('agent_id', agentId).maybeSingle()
  return data as AgentProfileIntelligence | null
}

export async function getAgentCareer(supabase: SupabaseClient, agentId: string): Promise<AgentCareer | null> {
  const { data } = await supabase.from('agent_careers').select('*').eq('agent_id', agentId).maybeSingle()
  return data as AgentCareer | null
}

export async function getOrganizationHealth(supabase: SupabaseClient, organizationId: string): Promise<OrganizationHealth | null> {
  const { data } = await supabase.from('organization_health').select('*').eq('organization_id', organizationId).maybeSingle()
  return data as OrganizationHealth | null
}

export async function getWorkflowIntelligence(supabase: SupabaseClient, workflowId: string): Promise<WorkflowIntelligence | null> {
  const { data, error } = await supabase.rpc('get_workflow_intelligence', { p_workflow_id: workflowId }).single()
  if (error || !data) return null
  return data as WorkflowIntelligence
}

export async function rankAgents(supabase: SupabaseClient, limit = 20): Promise<RankedAgent[]> {
  const { data } = await supabase.rpc('rank_agents', { p_limit: limit })
  return (data as RankedAgent[]) || []
}

export async function rankOrganizations(supabase: SupabaseClient, limit = 20): Promise<RankedOrganization[]> {
  const { data } = await supabase.rpc('rank_organizations', { p_limit: limit })
  return (data as RankedOrganization[]) || []
}

export async function findBestWorkflows(supabase: SupabaseClient, limit = 10): Promise<RankedWorkflow[]> {
  const { data } = await supabase.rpc('find_best_workflows', { p_limit: limit })
  return (data as RankedWorkflow[]) || []
}

export async function findWorstWorkflows(supabase: SupabaseClient, limit = 10): Promise<RankedWorkflow[]> {
  const { data } = await supabase.rpc('find_worst_workflows', { p_limit: limit })
  return (data as RankedWorkflow[]) || []
}

export async function rankTemplates(supabase: SupabaseClient, limit = 20): Promise<RankedTemplate[]> {
  const { data } = await supabase.rpc('rank_templates', { p_limit: limit })
  return (data as RankedTemplate[]) || []
}

export async function compareAgents(supabase: SupabaseClient, agentIdA: string, agentIdB: string): Promise<AgentComparison[]> {
  const { data } = await supabase.rpc('compare_agents', { p_agent_id_a: agentIdA, p_agent_id_b: agentIdB })
  return (data as AgentComparison[]) || []
}

export async function compareOrganizations(supabase: SupabaseClient, orgIdA: string, orgIdB: string): Promise<OrganizationComparison[]> {
  const { data } = await supabase.rpc('compare_organizations', { p_org_id_a: orgIdA, p_org_id_b: orgIdB })
  return (data as OrganizationComparison[]) || []
}

export async function compareWorkflows(supabase: SupabaseClient, workflowIdA: string, workflowIdB: string): Promise<WorkflowComparison[]> {
  const { data } = await supabase.rpc('compare_workflows', { p_workflow_id_a: workflowIdA, p_workflow_id_b: workflowIdB })
  return (data as WorkflowComparison[]) || []
}

export async function detectAnomalies(supabase: SupabaseClient): Promise<AnomalyReport | null> {
  const { data, error } = await supabase.rpc('detect_anomalies')
  if (error || !data) return null
  return data as AnomalyReport
}

export async function getPredictions(supabase: SupabaseClient, limit = 50): Promise<WorkforcePrediction[]> {
  const { data } = await supabase.from('workforce_predictions').select('*').order('created_at', { ascending: false }).limit(limit)
  return (data as WorkforcePrediction[]) || []
}

export async function refreshPredictionsForOrganization(supabase: SupabaseClient, organizationId: string): Promise<{ count: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('refresh_predictions_for_organization', { p_org_id: organizationId })
  if (error) return { count: null, error: error.message }
  return { count: data as number, error: null }
}

export async function getRecommendations(supabase: SupabaseClient, status?: string, limit = 50): Promise<WorkforceRecommendation[]> {
  let query = supabase.from('workforce_recommendations').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status) query = query.eq('status', status)
  const { data } = await query
  return (data as WorkforceRecommendation[]) || []
}

export async function generateRecommendationsForOrganization(supabase: SupabaseClient, organizationId: string): Promise<{ count: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('generate_recommendations_for_organization', { p_org_id: organizationId })
  if (error) return { count: null, error: error.message }
  return { count: data as number, error: null }
}

export async function approveRecommendation(supabase: SupabaseClient, recommendationId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('approve_recommendation', { p_recommendation_id: recommendationId })
  return { error: error?.message || null }
}

export async function rejectRecommendation(supabase: SupabaseClient, recommendationId: string, note?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('reject_recommendation', { p_recommendation_id: recommendationId, p_note: note || null })
  return { error: error?.message || null }
}

export async function applyRecommendation(supabase: SupabaseClient, recommendationId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('apply_recommendation', { p_recommendation_id: recommendationId })
  return { error: error?.message || null }
}

export async function generateExecutiveReport(supabase: SupabaseClient, reportType: ReportType): Promise<{ report: SystemReport | null; error: string | null }> {
  const { data, error } = await supabase.rpc('generate_system_report', { p_report_type: reportType }).single()
  if (error) return { report: null, error: error.message }
  return { report: data as SystemReport, error: null }
}

export async function getExecutiveReports(supabase: SupabaseClient, limit = 10): Promise<SystemReport[]> {
  const { data } = await supabase.from('system_reports').select('*').order('created_at', { ascending: false }).limit(limit)
  return (data as SystemReport[]) || []
}

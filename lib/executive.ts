import { SupabaseClient } from '@supabase/supabase-js'
import { AutonomyLevel, KnowledgeGraph, OrganizationExecutive, PerformanceIntelligence } from './types'

export async function getOrganizationExecutive(supabase: SupabaseClient, organizationId: string): Promise<OrganizationExecutive | null> {
  const { data } = await supabase.from('organization_executive').select('*').eq('organization_id', organizationId).maybeSingle()
  return (data as OrganizationExecutive) || null
}

export async function setAutonomyLevel(supabase: SupabaseClient, organizationId: string, level: AutonomyLevel): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_autonomy_level', { p_org_id: organizationId, p_level: level })
  return { error: error?.message || null }
}

export async function getStrategicRecommendations(supabase: SupabaseClient, organizationId: string): Promise<string[]> {
  const { data } = await supabase.rpc('get_strategic_recommendations', { p_org_id: organizationId })
  return (data as string[]) || []
}

export async function getOrganizationKnowledgeGraph(supabase: SupabaseClient, organizationId: string): Promise<KnowledgeGraph | null> {
  const { data, error } = await supabase.rpc('get_organization_knowledge_graph', { p_org_id: organizationId })
  if (error || !data) return null
  return data as KnowledgeGraph
}

export async function getPerformanceIntelligence(supabase: SupabaseClient, organizationId: string): Promise<PerformanceIntelligence | null> {
  const { data, error } = await supabase.rpc('get_performance_intelligence', { p_org_id: organizationId })
  if (error || !data) return null
  return data as PerformanceIntelligence
}

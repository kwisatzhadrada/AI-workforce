import { SupabaseClient } from '@supabase/supabase-js'
import { getOrganizationExecutive, getOrganizationKnowledgeGraph, getPerformanceIntelligence, getStrategicRecommendations } from './executive'
import { generateLessonsLearned } from './memory'
import { getExecutiveBriefs } from './briefs'
import { getExperiments } from './experiments'
import { getOpportunities } from './opportunities'
import { getRevenueAttribution } from './revenueAttribution'
import { ExecutiveBrief, Experiment, KnowledgeGraph, Opportunities, OrganizationExecutive, PerformanceIntelligence, RevenueAttribution } from './types'

export type ExecutiveCommandCenterData = {
  executive: OrganizationExecutive | null
  recommendations: string[]
  lessons: string[]
  performance: PerformanceIntelligence | null
  knowledgeGraph: KnowledgeGraph | null
  latestBrief: ExecutiveBrief | null
  experiments: Experiment[]
  opportunities: Opportunities | null
  revenueAttribution: RevenueAttribution | null
}

// One read-only bundle for the Executive Command Center — everything
// here is either a direct read or a fixed-rule aggregation over data
// that already exists elsewhere; nothing is generated or mutated by
// this call (brief generation and experiment actions are separate,
// explicit user actions with their own RPCs).
export async function getExecutiveCommandCenterData(supabase: SupabaseClient, organizationId: string): Promise<ExecutiveCommandCenterData> {
  const [executive, recommendations, lessons, performance, knowledgeGraph, briefs, experiments, opportunities, revenueAttribution] = await Promise.all([
    getOrganizationExecutive(supabase, organizationId),
    getStrategicRecommendations(supabase, organizationId),
    generateLessonsLearned(supabase, organizationId),
    getPerformanceIntelligence(supabase, organizationId),
    getOrganizationKnowledgeGraph(supabase, organizationId),
    getExecutiveBriefs(supabase, organizationId),
    getExperiments(supabase, organizationId),
    getOpportunities(supabase, organizationId),
    getRevenueAttribution(supabase, organizationId),
  ])

  return {
    executive,
    recommendations,
    lessons,
    performance,
    knowledgeGraph,
    latestBrief: briefs[0] || null,
    experiments,
    opportunities,
    revenueAttribution,
  }
}

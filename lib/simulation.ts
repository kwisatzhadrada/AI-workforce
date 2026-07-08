import { SupabaseClient } from '@supabase/supabase-js'
import {
  AutonomyScore,
  IdleAgent,
  NetworkHealth,
  OverloadedAgent,
  ReportType,
  SimulationMetric,
  SimulationRun,
  StuckGoal,
  SystemReport,
  TaskAssignmentFailure,
  TrustScoreAnomaly,
  WorkflowDeadlock,
} from './types'

export async function startSimulationRun(
  supabase: SupabaseClient,
  targets?: {
    agents?: number
    organizations?: number
    tasks?: number
    goals?: number
    workflows?: number
  }
): Promise<{ run: SimulationRun | null; error: string | null }> {
  const { data, error } = await supabase.rpc('start_simulation_run', {
    p_target_agents: targets?.agents ?? 100,
    p_target_organizations: targets?.organizations ?? 20,
    p_target_tasks: targets?.tasks ?? 1000,
    p_target_goals: targets?.goals ?? 100,
    p_target_workflows: targets?.workflows ?? 50,
  })

  if (error) return { run: null, error: error.message }
  return { run: data as SimulationRun, error: null }
}

export async function getSimulationRuns(supabase: SupabaseClient, limit = 10): Promise<SimulationRun[]> {
  const { data } = await supabase.from('simulation_runs').select('*').order('created_at', { ascending: false }).limit(limit)
  return (data as SimulationRun[]) || []
}

export async function getSimulationMetrics(supabase: SupabaseClient, runId: string): Promise<SimulationMetric[]> {
  const { data } = await supabase.from('simulation_metrics').select('*').eq('run_id', runId)
  return (data as SimulationMetric[]) || []
}

export async function getNetworkHealth(supabase: SupabaseClient): Promise<NetworkHealth | null> {
  const { data, error } = await supabase.rpc('get_network_health').single()
  if (error || !data) return null
  return data as NetworkHealth
}

export async function getAutonomyScore(supabase: SupabaseClient): Promise<AutonomyScore | null> {
  const { data, error } = await supabase.rpc('compute_autonomy_score').single()
  if (error || !data) return null
  return data as AutonomyScore
}

export async function getBottlenecks(supabase: SupabaseClient) {
  const [{ data: overloaded }, { data: idle }, { data: deadlocks }, { data: stuckGoals }, { data: assignmentFailures }, { data: trustAnomalies }] =
    await Promise.all([
      supabase.rpc('find_overloaded_agents', { p_limit: 20 }),
      supabase.rpc('find_idle_agents', { p_limit: 20 }),
      supabase.rpc('find_workflow_deadlocks', { p_limit: 20 }),
      supabase.rpc('find_stuck_goals', { p_limit: 20 }),
      supabase.rpc('find_task_assignment_failures', { p_limit: 20 }),
      supabase.rpc('find_trust_score_anomalies', { p_limit: 20 }),
    ])

  return {
    overloadedAgents: (overloaded as OverloadedAgent[]) || [],
    idleAgents: (idle as IdleAgent[]) || [],
    workflowDeadlocks: (deadlocks as WorkflowDeadlock[]) || [],
    stuckGoals: (stuckGoals as StuckGoal[]) || [],
    taskAssignmentFailures: (assignmentFailures as TaskAssignmentFailure[]) || [],
    trustScoreAnomalies: (trustAnomalies as TrustScoreAnomaly[]) || [],
  }
}

export async function generateSystemReport(
  supabase: SupabaseClient,
  reportType: ReportType
): Promise<{ report: SystemReport | null; error: string | null }> {
  const { data, error } = await supabase.rpc('generate_system_report', { p_report_type: reportType }).single()
  if (error) return { report: null, error: error.message }
  return { report: data as SystemReport, error: null }
}

export async function getSystemReports(supabase: SupabaseClient, limit = 10): Promise<SystemReport[]> {
  const { data } = await supabase.from('system_reports').select('*').order('created_at', { ascending: false }).limit(limit)
  return (data as SystemReport[]) || []
}

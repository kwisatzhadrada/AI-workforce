import { SupabaseClient } from '@supabase/supabase-js'
import {
  AssignmentDecisionRow,
  ExecutionFailureRow,
  ExecutionHistoryRow,
  IntegrationHistoryRow,
  TaskRetryRow,
} from './types'

export async function getExecutionHistory(supabase: SupabaseClient, limit = 50): Promise<ExecutionHistoryRow[]> {
  const { data } = await supabase.rpc('get_execution_history', { p_limit: limit })
  return (data as ExecutionHistoryRow[]) || []
}

export async function getIntegrationHistory(supabase: SupabaseClient, limit = 50): Promise<IntegrationHistoryRow[]> {
  const { data } = await supabase.rpc('get_integration_history', { p_limit: limit })
  return (data as IntegrationHistoryRow[]) || []
}

export async function getExecutionFailures(supabase: SupabaseClient, limit = 50): Promise<ExecutionFailureRow[]> {
  const { data } = await supabase.rpc('get_execution_failures', { p_limit: limit })
  return (data as ExecutionFailureRow[]) || []
}

export async function getTaskRetryCounts(supabase: SupabaseClient, limit = 50): Promise<TaskRetryRow[]> {
  const { data } = await supabase.rpc('get_task_retry_counts', { p_limit: limit })
  return (data as TaskRetryRow[]) || []
}

export async function getAssignmentDecisions(supabase: SupabaseClient, limit = 50): Promise<AssignmentDecisionRow[]> {
  const { data } = await supabase.rpc('get_assignment_decisions', { p_limit: limit })
  return (data as AssignmentDecisionRow[]) || []
}

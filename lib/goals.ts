import { SupabaseClient } from '@supabase/supabase-js'
import { GoalPlan, OrganizationGoal, TaskPriority } from './types'

// ============================================================
// Goals
// ============================================================

export async function createGoal(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    createdBy: string
    title: string
    description?: string
    priority?: TaskPriority
    targetMetrics?: Record<string, unknown>
    deadline?: string | null
    managerAgentId?: string | null
  }
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('organization_goals')
    .insert({
      organization_id: params.organizationId,
      created_by: params.createdBy,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      priority: params.priority || 'medium',
      target_metrics: params.targetMetrics || {},
      deadline: params.deadline || null,
      manager_agent_id: params.managerAgentId || null,
    })
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data.id, error: null }
}

export async function updateGoal(
  supabase: SupabaseClient,
  goalId: string,
  updates: Partial<Pick<OrganizationGoal, 'title' | 'description' | 'priority' | 'target_metrics' | 'deadline' | 'manager_agent_id'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('organization_goals').update(updates).eq('id', goalId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function setGoalPaused(supabase: SupabaseClient, goalId: string, paused: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('organization_goals').update({ is_paused: paused }).eq('id', goalId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function setGoalStatus(supabase: SupabaseClient, goalId: string, status: 'active' | 'failed'): Promise<{ error: string | null }> {
  const { error } = await supabase.from('organization_goals').update({ status }).eq('id', goalId)
  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// Plans
// ============================================================

export async function createPlan(
  supabase: SupabaseClient,
  goalId: string,
  createdBy: string,
  generatedBy: 'human' | 'ai' = 'human'
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('goal_plans')
    .insert({ goal_id: goalId, created_by: createdBy, generated_by: generatedBy })
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data.id, error: null }
}

export async function addPlanStep(
  supabase: SupabaseClient,
  planId: string,
  step: { stepOrder: number; title: string; description?: string; departmentId?: string | null; estimatedEffortHours?: number | null; dependsOnStepIds?: string[] }
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('goal_plan_steps')
    .insert({
      plan_id: planId,
      step_order: step.stepOrder,
      title: step.title.trim(),
      description: step.description?.trim() || null,
      department_id: step.departmentId || null,
      estimated_effort_hours: step.estimatedEffortHours ?? null,
    })
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }

  if (step.dependsOnStepIds && step.dependsOnStepIds.length > 0) {
    await supabase.from('goal_plan_step_dependencies').insert(
      step.dependsOnStepIds.map((depId) => ({ step_id: data.id, depends_on_step_id: depId }))
    )
  }

  return { id: data.id, error: null }
}

export async function approvePlan(supabase: SupabaseClient, planId: string): Promise<{ plan: GoalPlan | null; error: string | null }> {
  const { data, error } = await supabase.rpc('approve_goal_plan', { p_plan_id: planId })
  if (error) return { plan: null, error: error.message }
  return { plan: data as GoalPlan, error: null }
}

export async function rejectPlan(supabase: SupabaseClient, planId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('reject_goal_plan', { p_plan_id: planId })
  if (error) return { error: error.message }
  return { error: null }
}

export async function runManagerCycle(supabase: SupabaseClient, goalId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('run_goal_manager_cycle', { p_goal_id: goalId })
  if (error) return { error: error.message }
  return { error: null }
}

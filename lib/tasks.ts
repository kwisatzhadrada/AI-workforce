import { SupabaseClient } from '@supabase/supabase-js'
import { TaskPriority, TaskStatus } from './types'

export async function createTask(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    departmentId?: string | null
    assignedAgentId?: string | null
    createdBy: string
    title: string
    description?: string
    priority?: TaskPriority
    dueDate?: string | null
  }
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: params.organizationId,
      department_id: params.departmentId || null,
      assigned_agent_id: params.assignedAgentId || null,
      created_by: params.createdBy,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      priority: params.priority || 'medium',
      due_date: params.dueDate || null,
    })
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data.id, error: null }
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: TaskStatus
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function submitTaskOutput(
  supabase: SupabaseClient,
  taskId: string,
  params: { resultSummary?: string; attachments?: string[]; status?: TaskStatus }
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {}
  if (params.resultSummary !== undefined) patch.result_summary = params.resultSummary.trim() || null
  if (params.attachments !== undefined) patch.attachments = params.attachments.filter(Boolean)
  if (params.status) patch.status = params.status

  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function assignTaskAgent(
  supabase: SupabaseClient,
  taskId: string,
  agentId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tasks').update({ assigned_agent_id: agentId }).eq('id', taskId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function submitTaskReview(
  supabase: SupabaseClient,
  params: {
    taskId: string
    reviewerId: string
    rating: number
    feedback?: string
    qualityScore?: number
    speedScore?: number
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('task_reviews').insert({
    task_id: params.taskId,
    reviewer_id: params.reviewerId,
    rating: params.rating,
    feedback: params.feedback?.trim() || null,
    quality_score: params.qualityScore ?? null,
    speed_score: params.speedScore ?? null,
  })

  if (error) return { error: error.message }
  return { error: null }
}

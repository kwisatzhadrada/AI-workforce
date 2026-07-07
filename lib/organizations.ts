import { SupabaseClient } from '@supabase/supabase-js'
import { AssignmentPriority, WorkflowRun } from './types'

// ============================================================
// Members
// ============================================================

export async function addOrganizationMember(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  roleId: string,
  invitedBy: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('organization_members').insert({
    organization_id: organizationId,
    user_id: userId,
    role_id: roleId,
    invited_by: invitedBy,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function removeOrganizationMember(
  supabase: SupabaseClient,
  memberId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('organization_members').delete().eq('id', memberId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function updateMemberRole(
  supabase: SupabaseClient,
  memberId: string,
  roleId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('organization_members').update({ role_id: roleId }).eq('id', memberId)
  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// Departments
// ============================================================

export async function createDepartment(
  supabase: SupabaseClient,
  organizationId: string,
  name: string
): Promise<{ error: string | null }> {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const { error } = await supabase.from('organization_departments').insert({
    organization_id: organizationId,
    name: name.trim(),
    slug,
    is_custom: true,
  })

  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// Agent assignments
// ============================================================

export async function assignAgent(
  supabase: SupabaseClient,
  params: {
    agentId: string
    organizationId: string
    departmentId?: string | null
    managerType?: 'user' | 'agent' | null
    managerId?: string | null
    priority?: AssignmentPriority
    assignedBy: string
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_assignments').insert({
    agent_id: params.agentId,
    organization_id: params.organizationId,
    department_id: params.departmentId || null,
    manager_type: params.managerType || null,
    manager_id: params.managerId || null,
    priority: params.priority || 'medium',
    assigned_by: params.assignedBy,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function updateAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
  updates: { status?: string; priority?: AssignmentPriority; departmentId?: string | null }
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {}
  if (updates.status) patch.status = updates.status
  if (updates.priority) patch.priority = updates.priority
  if (updates.departmentId !== undefined) patch.department_id = updates.departmentId

  const { error } = await supabase.from('agent_assignments').update(patch).eq('id', assignmentId)
  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// Workflows
// ============================================================

export async function createWorkflow(
  supabase: SupabaseClient,
  organizationId: string,
  createdBy: string,
  name: string,
  description?: string
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('workflows')
    .insert({ organization_id: organizationId, created_by: createdBy, name: name.trim(), description: description?.trim() || null })
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data.id, error: null }
}

export async function addWorkflowStep(
  supabase: SupabaseClient,
  workflowId: string,
  step: { stepOrder: number; name: string; departmentId?: string | null; agentId?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('workflow_steps').insert({
    workflow_id: workflowId,
    step_order: step.stepOrder,
    name: step.name.trim(),
    department_id: step.departmentId || null,
    agent_id: step.agentId || null,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function startWorkflowRun(
  supabase: SupabaseClient,
  workflowId: string
): Promise<{ run: WorkflowRun | null; error: string | null }> {
  const { data, error } = await supabase.rpc('start_workflow_run', { p_workflow_id: workflowId })
  if (error) return { run: null, error: error.message }
  return { run: data as WorkflowRun, error: null }
}

export async function advanceWorkflowRun(
  supabase: SupabaseClient,
  runId: string,
  status: 'completed' | 'failed' | 'skipped',
  notes?: string
): Promise<{ run: WorkflowRun | null; error: string | null }> {
  const { data, error } = await supabase.rpc('advance_workflow_run', {
    p_run_id: runId,
    p_status: status,
    p_notes: notes || null,
  })
  if (error) return { run: null, error: error.message }
  return { run: data as WorkflowRun, error: null }
}

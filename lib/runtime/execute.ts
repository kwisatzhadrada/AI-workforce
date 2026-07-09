import { SupabaseClient } from '@supabase/supabase-js'
import { getProvider, ModelProviderName, ProviderConfigError } from '@/lib/providers'
import { IntegrationConfigError } from '@/lib/integrations'
import { runCrmSync, runEmailOutreachDraft, runProspectEnrichment } from './salesActions'
import { AgentExecution, IntegrationAction } from '@/lib/types'

export type RunExecutionParams = {
  agentId: string
  createdBy: string
  taskId?: string | null
  capabilityId?: string | null
  provider?: ModelProviderName
  input: Record<string, unknown>
}

export type RunExecutionResult = {
  execution: AgentExecution | null
  error: string | null
}

// Orchestrates one execution end to end: decision engine gate, provider
// call, and writing the auditable trail (execution row, cost debit,
// completion decision). Runs inline within the request — there's no
// background worker in this stack, so "queued" is a real but brief state.
export async function runAgentExecution(supabase: SupabaseClient, params: RunExecutionParams): Promise<RunExecutionResult> {
  const { agentId, createdBy, taskId = null, capabilityId = null, input } = params
  const providerName: ModelProviderName = params.provider || 'openai'

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, status')
    .eq('id', agentId)
    .maybeSingle()
  if (agentError || !agent) {
    return { execution: null, error: agentError?.message || 'Agent not found' }
  }

  let capability: { id: string; name: string; description: string | null; input_schema: unknown; output_schema: unknown; cost_estimate: number; integration_action: IntegrationAction | null } | null = null
  if (capabilityId) {
    const { data } = await supabase
      .from('agent_capabilities')
      .select('id, name, description, input_schema, output_schema, cost_estimate, integration_action')
      .eq('id', capabilityId)
      .maybeSingle()
    capability = data
  }

  const { data: accepted, error: decisionError } = await supabase.rpc('decide_agent_accept_task', {
    p_agent_id: agentId,
    p_task_id: taskId,
    p_capability_id: capabilityId,
  })
  if (decisionError) {
    return { execution: null, error: decisionError.message }
  }

  if (!accepted) {
    const { data: decision } = await supabase
      .from('agent_decisions')
      .select('reasoning')
      .eq('agent_id', agentId)
      .eq('decision_type', 'accept_task')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: rejected } = await supabase
      .from('agent_executions')
      .insert({
        agent_id: agentId,
        task_id: taskId,
        capability_id: capabilityId,
        status: 'failed',
        provider: providerName,
        input,
        error: decision?.reasoning || 'Agent declined to accept this task',
        created_by: createdBy,
      })
      .select('*')
      .single()

    return { execution: (rejected as AgentExecution) || null, error: null }
  }

  const { data: queued, error: insertError } = await supabase
    .from('agent_executions')
    .insert({
      agent_id: agentId,
      task_id: taskId,
      capability_id: capabilityId,
      status: 'queued',
      provider: providerName,
      input,
      created_by: createdBy,
      integration_action: capability?.integration_action || null,
    })
    .select('*')
    .single()

  if (insertError || !queued) {
    // 23505 = unique_violation. The partial unique index on
    // (task_id, integration_action) is what actually prevents a real-world
    // side effect (an email send, a CRM write) from firing twice for the
    // same task — this just turns the raw constraint error into a message
    // that explains what happened instead of a bare Postgres error string.
    if (insertError?.code === '23505') {
      return {
        execution: null,
        error: `${capability?.name || 'This action'} has already run (or is currently running) for this task — create a new task if more work is genuinely needed`,
      }
    }
    return { execution: null, error: insertError?.message || 'Failed to create execution' }
  }

  await supabase.from('agent_executions').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', queued.id)

  let integrationOrgId: string | null = null

  try {
    let executionOutput: Record<string, unknown>
    let taskOutput: Record<string, unknown> | null = null
    let model: string | null = null
    let tokensUsed: number | null = null

    if (capability?.integration_action) {
      // Real work: the capability is wired to an actual integration
      // action rather than a bare LLM call — see lib/runtime/salesActions.ts.
      if (!taskId) {
        throw new Error(`${capability.name} requires a task (real prospect/email/CRM context comes from the task)`)
      }
      const { data: task } = await supabase.from('tasks').select('organization_id').eq('id', taskId).maybeSingle()
      if (!task?.organization_id) {
        throw new Error('Task not found or has no organization')
      }
      integrationOrgId = task.organization_id

      const result = await dispatchIntegrationAction(supabase, capability.integration_action, {
        organizationId: task.organization_id,
        agentId,
        agentName: agent.name,
        taskId,
        input,
        llmProvider: providerName,
      })
      executionOutput = result.output
      taskOutput = result.taskOutput
    } else {
      const systemPrompt = buildSystemPrompt(agent.name, capability)
      const userPrompt = buildUserPrompt(input, taskId)
      const provider = getProvider(providerName)
      const response = await provider.generate({ systemPrompt, userPrompt })
      executionOutput = { result: response.output }
      model = response.model
      tokensUsed = response.tokensUsed
    }

    const { data: completed } = await supabase
      .from('agent_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        output: executionOutput,
        model,
        tokens_used: tokensUsed,
      })
      .eq('id', queued.id)
      .select('*')
      .single()

    if (taskOutput && taskId) {
      await supabase.from('tasks').update({ output: taskOutput }).eq('id', taskId)
    }

    await supabase.rpc('decide_agent_complete_task', { p_agent_id: agentId, p_task_id: taskId, p_execution_id: queued.id })

    if (capability && capability.cost_estimate > 0) {
      // Insufficient balance shouldn't fail an already-completed execution —
      // the wallet debit is a side effect, not a precondition. supabase-js
      // resolves RPC errors on the return value rather than throwing, so a
      // failed debit (e.g. insufficient balance) is silently skipped here.
      await supabase.rpc('agent_wallet_transaction', {
        p_agent_id: agentId,
        p_type: 'debit',
        p_amount: capability.cost_estimate,
        p_description: `Execution cost: ${capability.name}`,
      })
    }

    return { execution: (completed as AgentExecution) || null, error: null }
  } catch (err) {
    const message = err instanceof ProviderConfigError || err instanceof IntegrationConfigError ? err.message : err instanceof Error ? err.message : 'Execution failed'

    const { data: failed } = await supabase
      .from('agent_executions')
      .update({ status: 'failed', completed_at: new Date().toISOString(), error: message })
      .eq('id', queued.id)
      .select('*')
      .single()

    await supabase.rpc('decide_request_assistance', { p_agent_id: agentId, p_task_id: taskId, p_execution_id: queued.id })

    // A real integration failure is worth recording against the
    // organization's connection status, not just the execution row — this
    // is what the Integrations tab and diagnostics page surface as
    // "last_error" so a broken connection is visible without reading logs.
    if (capability?.integration_action && integrationOrgId) {
      const provider = INTEGRATION_ACTION_PROVIDER[capability.integration_action]
      await supabase.rpc('record_integration_error', { p_org_id: integrationOrgId, p_provider: provider, p_error: message })
    }

    return { execution: (failed as AgentExecution) || null, error: null }
  }
}

const INTEGRATION_ACTION_PROVIDER: Record<IntegrationAction, string> = {
  prospect_enrich: 'hunter',
  email_draft_send: 'gmail',
  crm_upsert: 'hubspot',
}

async function dispatchIntegrationAction(
  supabase: SupabaseClient,
  action: IntegrationAction,
  params: { organizationId: string; agentId: string; agentName: string; taskId: string; input: Record<string, unknown>; llmProvider: ModelProviderName }
): Promise<{ output: Record<string, unknown>; taskOutput: Record<string, unknown> }> {
  switch (action) {
    case 'prospect_enrich':
      return runProspectEnrichment(supabase, params)
    case 'email_draft_send':
      return runEmailOutreachDraft(supabase, params)
    case 'crm_upsert':
      return runCrmSync(supabase, params)
  }
}

function buildSystemPrompt(agentName: string, capability: { name: string; description: string | null; output_schema: unknown } | null): string {
  const lines = [`You are ${agentName}, an AI agent performing a specific work task.`]
  if (capability) {
    lines.push(`Your capability for this task is "${capability.name}".`)
    if (capability.description) lines.push(capability.description)
    if (capability.output_schema && Object.keys(capability.output_schema as object).length > 0) {
      lines.push(`Respond in a way that fits this output shape: ${JSON.stringify(capability.output_schema)}`)
    }
  }
  lines.push('Be concise and directly useful. Do not narrate what you are about to do — just do it.')
  return lines.join(' ')
}

function buildUserPrompt(input: Record<string, unknown>, taskId: string | null): string {
  const parts: string[] = []
  if (taskId) parts.push(`Task ID: ${taskId}`)
  if (input.title) parts.push(`Title: ${input.title}`)
  if (input.description) parts.push(`Description: ${input.description}`)
  const rest = Object.fromEntries(Object.entries(input).filter(([k]) => !['title', 'description'].includes(k)))
  if (Object.keys(rest).length > 0) parts.push(`Additional context: ${JSON.stringify(rest)}`)
  return parts.length > 0 ? parts.join('\n') : 'Perform the assigned work.'
}

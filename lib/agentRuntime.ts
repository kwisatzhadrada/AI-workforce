import { SupabaseClient } from '@supabase/supabase-js'
import { MemoryType, MessageReceiverType, AgentMessageType } from './types'

// ============================================================
// Capabilities
// ============================================================

export async function addCapability(
  supabase: SupabaseClient,
  agentId: string,
  params: { name: string; description?: string; costEstimate?: number; inputSchema?: object; outputSchema?: object }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_capabilities').insert({
    agent_id: agentId,
    name: params.name.trim(),
    description: params.description?.trim() || null,
    cost_estimate: params.costEstimate ?? 0,
    input_schema: params.inputSchema || {},
    output_schema: params.outputSchema || {},
  })
  if (error) return { error: error.message }
  return { error: null }
}

export async function toggleCapability(
  supabase: SupabaseClient,
  capabilityId: string,
  enabled: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_capabilities').update({ enabled }).eq('id', capabilityId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function removeCapability(supabase: SupabaseClient, capabilityId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_capabilities').delete().eq('id', capabilityId)
  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// Memory
// ============================================================

export async function upsertMemory(
  supabase: SupabaseClient,
  agentId: string,
  params: { memoryType: MemoryType; key: string; value: unknown; organizationId?: string | null; importance?: number }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_memory').upsert(
    {
      agent_id: agentId,
      organization_id: params.organizationId || null,
      memory_type: params.memoryType,
      key: params.key.trim(),
      value: typeof params.value === 'string' ? { text: params.value } : params.value,
      importance: params.importance ?? 0.5,
    },
    { onConflict: 'agent_id,memory_type,key' }
  )
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteMemory(supabase: SupabaseClient, memoryId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_memory').delete().eq('id', memoryId)
  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// Messages
// ============================================================

export async function sendAgentMessage(
  supabase: SupabaseClient,
  params: {
    senderAgentId: string
    receiverType: MessageReceiverType
    receiverId: string
    messageType?: AgentMessageType
    content: string
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_messages').insert({
    sender_agent_id: params.senderAgentId,
    receiver_type: params.receiverType,
    receiver_id: params.receiverId,
    message_type: params.messageType || 'update',
    content: params.content.trim(),
  })
  if (error) return { error: error.message }
  return { error: null }
}

export async function markMessageRead(supabase: SupabaseClient, messageId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_messages').update({ read_at: new Date().toISOString() }).eq('id', messageId)
  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// Delegation
// ============================================================

export async function proposeDelegation(
  supabase: SupabaseClient,
  params: { taskId: string; fromAgentId: string; toAgentId: string; reason?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('delegations').insert({
    task_id: params.taskId,
    from_agent_id: params.fromAgentId,
    to_agent_id: params.toAgentId,
    reason: params.reason?.trim() || null,
  })
  if (error) return { error: error.message }
  return { error: null }
}

export async function respondToDelegation(
  supabase: SupabaseClient,
  delegationId: string,
  status: 'accepted' | 'rejected',
  outcome?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('delegations').update({ status, outcome: outcome?.trim() || null }).eq('id', delegationId)
  if (error) return { error: error.message }
  return { error: null }
}

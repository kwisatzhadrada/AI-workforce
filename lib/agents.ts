import { SupabaseClient } from '@supabase/supabase-js'
import { AgentTransaction, AgentTransactionType } from './types'

export async function rateAgent(
  supabase: SupabaseClient,
  agentId: string,
  raterId: string,
  score: number,
  comment?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('agent_ratings')
    .upsert(
      { agent_id: agentId, rater_id: raterId, score, comment: comment?.trim() || null },
      { onConflict: 'agent_id,rater_id' }
    )

  if (error) return { error: error.message }
  return { error: null }
}

export async function submitAgentWalletTransaction(
  supabase: SupabaseClient,
  agentId: string,
  type: AgentTransactionType,
  amount: number,
  description?: string
): Promise<{ transaction: AgentTransaction | null; error: string | null }> {
  const { data, error } = await supabase.rpc('agent_wallet_transaction', {
    p_agent_id: agentId,
    p_type: type,
    p_amount: amount,
    p_description: description?.trim() || null,
  })

  if (error) return { transaction: null, error: error.message }
  return { transaction: data as AgentTransaction, error: null }
}

export async function recordAgentTask(
  supabase: SupabaseClient,
  agentId: string,
  success: boolean,
  responseTimeMs?: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_agent_task', {
    p_agent_id: agentId,
    p_success: success,
    p_response_time_ms: responseTimeMs ?? null,
  })

  if (error) return { error: error.message }
  return { error: null }
}

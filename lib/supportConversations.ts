import { SupabaseClient } from '@supabase/supabase-js'
import { ConversationCategory, ConversationPriority, ConversationStatus, SupportConversation, SupportMessage } from './types'

export async function createSupportConversation(
  supabase: SupabaseClient,
  params: { organizationId?: string | null; subject: string; category: ConversationCategory; body: string }
): Promise<{ conversation: SupportConversation | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_support_conversation', {
    p_org_id: params.organizationId || null,
    p_subject: params.subject,
    p_category: params.category,
    p_body: params.body,
  })
  if (error) return { conversation: null, error: error.message }
  return { conversation: data as SupportConversation, error: null }
}

export async function postSupportMessage(supabase: SupabaseClient, conversationId: string, body: string): Promise<{ message: SupportMessage | null; error: string | null }> {
  const { data, error } = await supabase.rpc('post_support_message', { p_conversation_id: conversationId, p_body: body })
  if (error) return { message: null, error: error.message }
  return { message: data as SupportMessage, error: null }
}

export async function updateSupportConversation(
  supabase: SupabaseClient,
  conversationId: string,
  updates: { status?: ConversationStatus; priority?: ConversationPriority }
): Promise<{ conversation: SupportConversation | null; error: string | null }> {
  const { data, error } = await supabase.rpc('update_support_conversation', {
    p_conversation_id: conversationId,
    p_status: updates.status || null,
    p_priority: updates.priority || null,
  })
  if (error) return { conversation: null, error: error.message }
  return { conversation: data as SupportConversation, error: null }
}

export async function getMyConversations(supabase: SupabaseClient, userId: string): Promise<SupportConversation[]> {
  const { data } = await supabase.from('support_conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  return (data as SupportConversation[]) || []
}

export async function getAllConversations(supabase: SupabaseClient): Promise<SupportConversation[]> {
  const { data } = await supabase
    .from('support_conversations')
    .select('*, profiles(id, full_name), organizations(id, name)')
    .order('updated_at', { ascending: false })
  return (data as SupportConversation[]) || []
}

export async function getConversationMessages(supabase: SupabaseClient, conversationId: string): Promise<SupportMessage[]> {
  const { data } = await supabase.from('support_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
  return (data as SupportMessage[]) || []
}

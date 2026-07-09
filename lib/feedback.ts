import { SupabaseClient } from '@supabase/supabase-js'
import { FeedbackStatus, FeedbackType, UserFeedback } from './types'

export async function submitFeedback(
  supabase: SupabaseClient,
  params: { userId: string; feedbackType: FeedbackType; message: string; organizationId?: string | null; pageUrl?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_feedback').insert({
    user_id: params.userId,
    feedback_type: params.feedbackType,
    message: params.message.trim(),
    organization_id: params.organizationId || null,
    page_url: params.pageUrl || null,
  })
  return { error: error?.message || null }
}

export async function getMyFeedback(supabase: SupabaseClient, userId: string): Promise<UserFeedback[]> {
  const { data } = await supabase
    .from('user_feedback')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as UserFeedback[]) || []
}

export async function getAllFeedback(supabase: SupabaseClient, status?: FeedbackStatus): Promise<UserFeedback[]> {
  let query = supabase.from('user_feedback').select('*, profiles(id, full_name)').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data } = await query
  return (data as UserFeedback[]) || []
}

export async function updateFeedbackStatus(
  supabase: SupabaseClient,
  feedbackId: string,
  status: FeedbackStatus,
  adminNotes?: string
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = { status }
  if (adminNotes !== undefined) updates.admin_notes = adminNotes
  const { error } = await supabase.from('user_feedback').update(updates).eq('id', feedbackId)
  return { error: error?.message || null }
}

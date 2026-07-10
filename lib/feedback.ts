import { SupabaseClient } from '@supabase/supabase-js'
import { BlockerReason, FeedbackSeverity, FeedbackStatus, FeedbackType, UserFeedback } from './types'

export async function submitFeedback(
  supabase: SupabaseClient,
  params: { userId: string; feedbackType: FeedbackType; message: string; organizationId?: string | null; pageUrl?: string | null; blockerReason?: BlockerReason | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_feedback').insert({
    user_id: params.userId,
    feedback_type: params.feedbackType,
    message: params.message.trim(),
    organization_id: params.organizationId || null,
    page_url: params.pageUrl || null,
    blocker_reason: params.blockerReason || null,
  })
  return { error: error?.message || null }
}

// "What is stopping you from getting value?" — same table as bug
// reports/feature requests (feedback_type: 'blocker' + blocker_reason),
// not a new parallel table, since it's still a single piece of user
// feedback with the same lifecycle (open -> in_progress -> resolved).
export async function submitBlockerFeedback(
  supabase: SupabaseClient,
  params: { userId: string; organizationId: string; blockerReason: BlockerReason; message: string; pageUrl?: string | null }
): Promise<{ error: string | null }> {
  return submitFeedback(supabase, {
    userId: params.userId,
    feedbackType: 'blocker',
    message: params.message.trim() || '(no additional detail provided)',
    organizationId: params.organizationId,
    pageUrl: params.pageUrl,
    blockerReason: params.blockerReason,
  })
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
  let query = supabase
    .from('user_feedback')
    .select('*, profiles(id, full_name), owner:profiles!user_feedback_owner_id_fkey(id, full_name)')
    .order('created_at', { ascending: false })
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

// Admin triage: severity/status/owner in one call, plus a manually-driven
// "this came up again" counter — see migration 022 for why frequency
// isn't automated duplicate detection.
export async function triageFeedback(
  supabase: SupabaseClient,
  feedbackId: string,
  updates: { status?: FeedbackStatus; severity?: FeedbackSeverity; ownerId?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('triage_feedback', {
    p_feedback_id: feedbackId,
    p_status: updates.status || null,
    p_severity: updates.severity || null,
    p_owner_id: updates.ownerId || null,
  })
  return { error: error?.message || null }
}

export async function bumpFeedbackFrequency(supabase: SupabaseClient, feedbackId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('bump_feedback_frequency', { p_feedback_id: feedbackId })
  return { error: error?.message || null }
}

// Admin list for the owner-assignment dropdown — profiles are publicly
// selectable (Phase 3), filtered client-side to is_admin here since
// there's no admin-only RLS reason to add a new RPC for a plain read.
export async function getAdmins(supabase: SupabaseClient): Promise<{ id: string; full_name: string | null }[]> {
  const { data } = await supabase.from('profiles').select('id, full_name').eq('is_admin', true).order('full_name')
  return data || []
}

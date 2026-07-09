import { SupabaseClient } from '@supabase/supabase-js'
import { Meeting, MeetingFunnel, MeetingStatus } from './types'

export async function createMeeting(
  supabase: SupabaseClient,
  params: { organizationId: string; contactEmail: string; contactName?: string | null; contactCompany?: string | null; taskId?: string | null; estimatedValue?: number | null }
): Promise<{ meeting: Meeting | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_meeting', {
    p_org_id: params.organizationId,
    p_contact_email: params.contactEmail,
    p_contact_name: params.contactName || null,
    p_contact_company: params.contactCompany || null,
    p_task_id: params.taskId || null,
    p_estimated_value: params.estimatedValue ?? null,
  })
  if (error) return { meeting: null, error: error.message }
  return { meeting: data as Meeting, error: null }
}

export async function updateMeetingStatus(
  supabase: SupabaseClient,
  meetingId: string,
  status: MeetingStatus,
  scheduledAt?: string | null
): Promise<{ meeting: Meeting | null; error: string | null }> {
  const { data, error } = await supabase.rpc('update_meeting_status', {
    p_meeting_id: meetingId,
    p_status: status,
    p_scheduled_at: scheduledAt || null,
  })
  if (error) return { meeting: null, error: error.message }
  return { meeting: data as Meeting, error: null }
}

export async function getMeetingFunnel(supabase: SupabaseClient, organizationId: string): Promise<MeetingFunnel | null> {
  const { data, error } = await supabase.rpc('get_meeting_funnel', { p_org_id: organizationId }).single()
  if (error || !data) return null
  return data as MeetingFunnel
}

export async function getMeetings(supabase: SupabaseClient, organizationId: string): Promise<Meeting[]> {
  const { data } = await supabase.from('meetings').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
  return (data as Meeting[]) || []
}

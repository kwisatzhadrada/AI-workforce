import { SupabaseClient } from '@supabase/supabase-js'
import { getCrmProvider, getEmailProvider } from '@/lib/integrations'
import { SalesActivity } from '@/lib/types'

export type CheckRepliesResult = {
  checked: number
  newReplies: number
  error: string | null
}

// Reply detection is on-demand, not a background poll — same "no cron in
// this stack" pattern every prior phase uses for anything that would
// otherwise need a scheduler (goal cycles, prediction refresh, workflow
// advance). An org member clicks "Check Replies"; this walks every sent
// email that hasn't been marked replied-to yet and asks Gmail for real.
export async function checkRepliesForOrganization(supabase: SupabaseClient, organizationId: string): Promise<CheckRepliesResult> {
  const { data: sentActivities, error: sentError } = await supabase
    .from('sales_activities')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('activity_type', 'email_sent')

  if (sentError) {
    return { checked: 0, newReplies: 0, error: sentError.message }
  }

  const { data: repliedActivities } = await supabase
    .from('sales_activities')
    .select('metadata')
    .eq('organization_id', organizationId)
    .eq('activity_type', 'reply_received')

  const alreadyReplied = new Set((repliedActivities || []).map((r: { metadata: Record<string, unknown> }) => r.metadata?.sent_message_id).filter(Boolean))

  const pending = ((sentActivities as SalesActivity[]) || []).filter((a) => !alreadyReplied.has(a.metadata?.messageId))
  if (pending.length === 0) {
    return { checked: 0, newReplies: 0, error: null }
  }

  let emailProvider
  try {
    emailProvider = await getEmailProvider(supabase, organizationId)
  } catch (err) {
    return { checked: 0, newReplies: 0, error: err instanceof Error ? err.message : 'Gmail is not connected' }
  }

  let crmProvider = null
  try {
    crmProvider = await getCrmProvider(supabase, organizationId)
  } catch {
    crmProvider = null // CRM is optional for reply detection itself
  }

  let newReplies = 0
  for (const activity of pending) {
    const threadId = activity.metadata?.threadId as string | undefined
    const messageId = activity.metadata?.messageId as string | undefined
    if (!threadId || !messageId) continue

    const reply = await emailProvider.checkReplies(threadId, messageId)
    if (!reply.hasReply) continue

    newReplies += 1
    await supabase.rpc('record_sales_activity', {
      p_org_id: organizationId,
      p_activity_type: 'reply_received',
      p_agent_id: activity.agent_id,
      p_task_id: activity.task_id,
      p_contact_email: activity.contact_email,
      p_contact_name: activity.contact_name,
      p_contact_company: activity.contact_company,
      p_metadata: { sent_message_id: messageId, thread_id: threadId, snippet: reply.replySnippet, replied_at: reply.repliedAt },
    })

    if (crmProvider && activity.contact_email) {
      try {
        const contactId = await crmProvider.findContactByEmail(activity.contact_email)
        if (contactId) {
          await crmProvider.logNote(contactId, `Prospect replied: "${reply.replySnippet || '(no preview)'}"`)
        }
      } catch {
        // A CRM note failure shouldn't hide a real reply that was already recorded.
      }
    }
  }

  return { checked: pending.length, newReplies, error: null }
}

export async function markMeetingBooked(
  supabase: SupabaseClient,
  params: { organizationId: string; contactEmail: string; contactName?: string | null; taskId?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_sales_activity', {
    p_org_id: params.organizationId,
    p_activity_type: 'meeting_booked',
    p_task_id: params.taskId || null,
    p_contact_email: params.contactEmail,
    p_contact_name: params.contactName || null,
  })
  return { error: error?.message || null }
}

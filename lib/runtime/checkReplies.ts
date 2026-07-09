import { SupabaseClient } from '@supabase/supabase-js'
import { getCrmProvider, getEmailProvider } from '@/lib/integrations'
import { SalesActivity } from '@/lib/types'

export type CheckRepliesResult = {
  checked: number
  newReplies: number
  failed: number
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
    return { checked: 0, newReplies: 0, failed: 0, error: sentError.message }
  }

  const { data: repliedActivities } = await supabase
    .from('sales_activities')
    .select('metadata')
    .eq('organization_id', organizationId)
    .eq('activity_type', 'reply_received')

  const alreadyReplied = new Set((repliedActivities || []).map((r: { metadata: Record<string, unknown> }) => r.metadata?.sent_message_id).filter(Boolean))

  const pending = ((sentActivities as SalesActivity[]) || []).filter((a) => !alreadyReplied.has(a.metadata?.messageId))
  if (pending.length === 0) {
    return { checked: 0, newReplies: 0, failed: 0, error: null }
  }

  let emailProvider
  try {
    emailProvider = await getEmailProvider(supabase, organizationId)
  } catch (err) {
    return { checked: 0, newReplies: 0, failed: 0, error: err instanceof Error ? err.message : 'Gmail is not connected' }
  }

  let crmProvider = null
  try {
    crmProvider = await getCrmProvider(supabase, organizationId)
  } catch {
    crmProvider = null // CRM is optional for reply detection itself
  }

  let newReplies = 0
  let failed = 0
  let connectionBroken = false

  for (const activity of pending) {
    if (connectionBroken) break

    const threadId = activity.metadata?.threadId as string | undefined
    const messageId = activity.metadata?.messageId as string | undefined
    if (!threadId || !messageId) continue

    // One bad thread lookup (deleted thread, a transient blip) must not
    // sink every other real reply in the same batch — this used to be an
    // unguarded call that would abort the whole loop on the first failure.
    let reply
    try {
      reply = await emailProvider.checkReplies(threadId, messageId)
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : 'Gmail thread lookup failed'
      if (message.includes('reconnect') || message.includes('revoked')) {
        // The connection itself is broken, not this one thread — record it
        // once and stop, rather than repeating the same failure for every
        // remaining item.
        connectionBroken = true
        await supabase.rpc('record_integration_error', { p_org_id: organizationId, p_provider: 'gmail', p_error: message })
      }
      continue
    }

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

  return { checked: pending.length - failed, newReplies, failed, error: null }
}

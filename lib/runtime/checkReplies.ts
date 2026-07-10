import { SupabaseClient } from '@supabase/supabase-js'
import { getCrmProvider, getEmailProvider } from '@/lib/integrations'
import { SalesActivity } from '@/lib/types'
import { classifyReply } from './replyClassifier'

export type CheckRepliesResult = {
  checked: number
  newReplies: number
  failed: number
  error: string | null
}

// Reply detection used to be strictly on-demand (a human clicks "Check
// Replies"). Phase 21's job queue can now call this exact same function
// on a schedule via the service-role client — record_sales_activity and
// create_meeting both accept a service-role caller (is_system_caller()),
// so this function works identically whichever caller invokes it, and
// classification/meeting-detection happens the same way either way.
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
    const { data: activityId } = await supabase.rpc('record_sales_activity', {
      p_org_id: organizationId,
      p_activity_type: 'reply_received',
      p_agent_id: activity.agent_id,
      p_task_id: activity.task_id,
      p_contact_email: activity.contact_email,
      p_contact_name: activity.contact_name,
      p_contact_company: activity.contact_company,
      p_metadata: { sent_message_id: messageId, thread_id: threadId, snippet: reply.replySnippet, replied_at: reply.repliedAt },
    })

    // AI Sales Operator: classify the real reply text into a real
    // category, and if it's an explicit meeting request, create the
    // meeting immediately instead of waiting for a human to notice and
    // log it. A classification failure (LLM not configured, bad
    // response) just means no classification — it never blocks the
    // reply itself from being recorded above.
    if (activity.contact_email) {
      const classified = await classifyReply(reply.replySnippet || '')
      if (classified) {
        await supabase.rpc('record_reply_classification', {
          p_org_id: organizationId,
          p_sales_activity_id: activityId || null,
          p_contact_email: activity.contact_email,
          p_contact_name: activity.contact_name,
          p_classification: classified.classification,
          p_confidence: classified.confidence,
          p_reasoning: classified.reasoning,
          p_action_items: classified.actionItems,
        })

        if (classified.classification === 'meeting_request') {
          await supabase.rpc('create_meeting', {
            p_org_id: organizationId,
            p_contact_email: activity.contact_email,
            p_contact_name: activity.contact_name,
            p_contact_company: activity.contact_company,
            p_task_id: activity.task_id,
            p_estimated_value: null,
          })
        }
      }
    }

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

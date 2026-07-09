import { SupabaseClient } from '@supabase/supabase-js'
import { getEmailProvider } from '@/lib/integrations'
import { OutreachDraft } from '@/lib/types'
import { SentEmailRecord } from './salesActions'

export type SendApprovedOutreachResult = {
  sent: SentEmailRecord[]
  failed: { email: string; error: string }[]
}

// The only path in this codebase that actually calls Gmail's send API for
// outreach. Deliberately NOT wired through runAgentExecution/
// agent_executions — like "Check Replies" and "Log a Booked Meeting"
// before it, this is a direct, human-triggered action with its own audit
// trail (sales_activities), not a re-run of a capability. That also
// sidesteps the Stabilization Sprint 1 duplicate-execution guard cleanly:
// there is exactly one execution row for the draft, and sending is a
// separate, explicitly human-gated act on that same task, not a second
// execution of it.
export async function sendApprovedOutreach(
  supabase: SupabaseClient,
  params: { organizationId: string; agentId: string; taskId: string }
): Promise<{ result: SendApprovedOutreachResult | null; error: string | null }> {
  const { data: task } = await supabase
    .from('tasks')
    .select('output, requires_approval, approved_at')
    .eq('id', params.taskId)
    .maybeSingle()

  if (!task) return { result: null, error: 'Task not found' }
  if (!task.requires_approval || !task.approved_at) {
    return { result: null, error: 'This outreach has not been approved yet — approve it before sending' }
  }

  const output = (task.output as Record<string, unknown>) || {}
  const drafts = (output.drafts as OutreachDraft[]) || []
  if (drafts.length === 0) {
    return { result: null, error: 'No drafted emails found on this task' }
  }
  if (Array.isArray(output.sent) && (output.sent as unknown[]).length > 0) {
    return { result: null, error: 'This outreach has already been sent' }
  }

  let emailProvider
  try {
    emailProvider = await getEmailProvider(supabase, params.organizationId)
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : 'Gmail is not connected' }
  }

  const sent: SentEmailRecord[] = []
  const failed: { email: string; error: string }[] = []

  for (const draft of drafts) {
    try {
      const result = await emailProvider.sendEmail({ to: draft.email, subject: draft.subject, body: draft.body })
      const record: SentEmailRecord = { email: draft.email, name: draft.name, messageId: result.messageId, threadId: result.threadId, sentAt: new Date().toISOString() }
      sent.push(record)

      await supabase.rpc('record_sales_activity', {
        p_org_id: params.organizationId,
        p_activity_type: 'email_sent',
        p_agent_id: params.agentId,
        p_task_id: params.taskId,
        p_contact_email: draft.email,
        p_contact_name: draft.name,
        p_contact_company: draft.company,
        p_metadata: { messageId: result.messageId, threadId: result.threadId, subject: draft.subject },
      })
    } catch (err) {
      failed.push({ email: draft.email, error: err instanceof Error ? err.message : 'send failed' })
    }
  }

  await supabase
    .from('tasks')
    .update({ output: { ...output, sent, send_failed: failed, emails_sent: sent.length } })
    .eq('id', params.taskId)

  return { result: { sent, failed }, error: null }
}

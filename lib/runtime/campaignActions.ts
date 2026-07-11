import { SupabaseClient } from '@supabase/supabase-js'
import { getEmailProvider } from '@/lib/integrations'
import { OutreachDraft } from '@/lib/types'
import { SentEmailRecord } from './salesActions'

export type SendApprovedOutreachResult = {
  sent: SentEmailRecord[]
  failed: { email: string; error: string }[]
  skippedDuplicates: string[]
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

  // Duplicate-send prevention: never contact the same real email address
  // twice across two different campaign runs — a single task's own
  // drafts are already deduplicated by the `output.sent` check above,
  // this catches the same contact resurfacing in a later research pass.
  const { data: alreadyContactedRows } = await supabase.rpc('get_already_contacted', {
    p_org_id: params.organizationId,
    p_emails: drafts.map((d) => d.email),
  })
  const alreadyContacted = new Set(((alreadyContactedRows as { contact_email: string }[]) || []).map((r) => r.contact_email))
  const toSend = drafts.filter((d) => !alreadyContacted.has(d.email))
  const skippedDuplicates = drafts.filter((d) => alreadyContacted.has(d.email)).map((d) => d.email)

  if (toSend.length === 0) {
    return { result: { sent: [], failed: [], skippedDuplicates }, error: skippedDuplicates.length > 0 ? 'Every contact on this task has already been emailed by this organization before' : null }
  }

  // Safety controls: a design partner's own free trial status and daily
  // send cap are both real, enforced gates — not just a UI suggestion —
  // checked once for the whole batch right before any Gmail API call.
  const { data: eligibility } = await supabase.rpc('check_send_eligibility', { p_org_id: params.organizationId, p_count: toSend.length }).single()
  if (eligibility && !(eligibility as { allowed: boolean }).allowed) {
    const reason = (eligibility as { reason: string }).reason
    const message = reason === 'daily_cap_exceeded'
      ? `Sending these ${toSend.length} email(s) would exceed this organization's daily send cap — wait until tomorrow or raise the cap in Campaign settings.`
      : 'This organization\'s trial has ended and there is no active subscription — subscribe on the Billing tab to keep sending.'
    return { result: null, error: message }
  }

  let emailProvider
  try {
    emailProvider = await getEmailProvider(supabase, params.organizationId)
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : 'Gmail is not connected' }
  }

  const sent: SentEmailRecord[] = []
  const failed: { email: string; error: string }[] = []

  for (const draft of toSend) {
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

  await supabase.rpc('log_audit_event', {
    p_org_id: params.organizationId,
    p_action: 'outreach_sent',
    p_target_type: 'tasks',
    p_target_id: params.taskId,
    p_metadata: { sent: sent.length, failed: failed.length, skipped_duplicates: skippedDuplicates.length },
  })

  await supabase
    .from('tasks')
    .update({ output: { ...output, sent, send_failed: failed, skipped_duplicates: skippedDuplicates, emails_sent: sent.length } })
    .eq('id', params.taskId)

  return { result: { sent, failed, skippedDuplicates }, error: null }
}

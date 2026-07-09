import { SupabaseClient } from '@supabase/supabase-js'
import { getCrmProvider, getEmailProvider, getProspectProvider } from '@/lib/integrations'
import { getProvider, ModelProviderName } from '@/lib/providers'
import { OutreachDraft } from '@/lib/types'
import { extractDomains } from '@/lib/utils'

export type EnrichedLead = {
  name: string | null
  email: string
  title: string | null
  company: string | null
  domain: string
}

export type SentEmailRecord = {
  email: string
  name: string | null
  messageId: string
  threadId: string
  sentAt: string
}

export type SalesActionResult = {
  output: Record<string, unknown>
  taskOutput: Record<string, unknown>
}

// Gathers real structured output (leads found, emails sent) from every
// other completed task in the same workflow run — this is how "Update
// CRM" sees the real prospects "Research Prospect" found and the real
// sends "Outreach" made, without adding any new step-to-step data-passing
// system: it just reads the workflow_run_id / task.output columns that
// already exist.
async function getWorkflowRunContext(
  supabase: SupabaseClient,
  taskId: string | null
): Promise<{ leads: EnrichedLead[]; sentEmails: SentEmailRecord[] }> {
  if (!taskId) return { leads: [], sentEmails: [] }

  const { data: task } = await supabase.from('tasks').select('workflow_run_id').eq('id', taskId).maybeSingle()
  if (!task?.workflow_run_id) return { leads: [], sentEmails: [] }

  const { data: siblingTasks } = await supabase
    .from('tasks')
    .select('output')
    .eq('workflow_run_id', task.workflow_run_id)
    .eq('status', 'completed')

  const leads: EnrichedLead[] = []
  const sentEmails: SentEmailRecord[] = []
  for (const t of siblingTasks || []) {
    const output = t.output as Record<string, unknown> | null
    if (Array.isArray(output?.leads)) leads.push(...(output!.leads as EnrichedLead[]))
    if (Array.isArray(output?.sent)) sentEmails.push(...(output!.sent as SentEmailRecord[]))
  }
  return { leads, sentEmails }
}

// Lead Research Agent: enrich every target-company domain named in the
// task (title/description) into real people via Hunter.io.
export async function runProspectEnrichment(
  supabase: SupabaseClient,
  params: { organizationId: string; agentId: string; taskId: string | null; input: Record<string, unknown> }
): Promise<SalesActionResult> {
  const text = `${params.input.title || ''} ${params.input.description || ''}`
  const domains = extractDomains(text)
  if (domains.length === 0) {
    throw new Error('No target company domains found in the task title/description (e.g. "Enrich: acme.com, beta.io")')
  }

  const provider = await getProspectProvider(supabase, params.organizationId)
  const leads: EnrichedLead[] = []
  const failedDomains: { domain: string; error: string }[] = []

  for (const domain of domains) {
    // One domain hitting a Hunter quota/rate-limit/network error must not
    // discard the leads already found for every other domain in the same
    // batch — record the failure and keep going.
    let enriched
    try {
      enriched = await provider.enrichDomain(domain)
    } catch (err) {
      failedDomains.push({ domain, error: err instanceof Error ? err.message : 'enrichment failed' })
      continue
    }

    for (const person of enriched.people) {
      const lead: EnrichedLead = {
        name: person.name,
        email: person.email,
        title: person.title,
        company: enriched.companyName,
        domain,
      }
      leads.push(lead)
      await supabase.rpc('record_sales_activity', {
        p_org_id: params.organizationId,
        p_activity_type: 'lead_found',
        p_agent_id: params.agentId,
        p_task_id: params.taskId,
        p_contact_email: lead.email,
        p_contact_name: lead.name,
        p_contact_company: lead.company,
        p_metadata: { title: lead.title, domain: lead.domain, confidence: person.confidence },
      })
    }
  }

  if (leads.length === 0 && failedDomains.length > 0) {
    throw new Error(`Could not enrich any of ${failedDomains.length} domain(s): ${failedDomains[0].error}`)
  }

  const output = { leads, domains_searched: domains, failed_domains: failedDomains, leads_found: leads.length }
  return { output, taskOutput: output }
}

// Outreach Agent: DRAFT ONLY. This runs as a normal capability execution
// (runAgentExecution -> here), and deliberately never calls sendEmail —
// the human-override requirement is that no real email leaves the
// building until an org supervisor explicitly reviews and approves it
// (see sendApprovedOutreach in campaignActions.ts, and the
// requires_approval/approved_at/approved_by columns added for this).
// Splitting "draft" from "send" this way needed no new integration_action
// and no new workflow step — it's the same capability, same task, same
// tasks.output column; only the behavior at the tail end changed.
export async function runEmailOutreachDraft(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    agentId: string
    agentName: string
    taskId: string | null
    input: Record<string, unknown>
    llmProvider: ModelProviderName
  }
): Promise<SalesActionResult> {
  const { leads } = await getWorkflowRunContext(supabase, params.taskId)
  if (leads.length === 0) {
    throw new Error('No enriched leads found from an earlier "Research Prospect" step in this workflow run')
  }

  const model = getProvider(params.llmProvider)
  const drafts: OutreachDraft[] = []
  const failed: { email: string; error: string }[] = []

  for (const lead of leads) {
    try {
      const draft = await model.generate({
        systemPrompt: `You are ${params.agentName}, a warm and concise B2B outbound copywriter. Write a short (under 120 words) personalized cold email. Reference the recipient's real name, title, and company where known. No generic filler. Respond with the email body only, no subject line, no preamble.`,
        userPrompt: `Recipient: ${lead.name || 'there'}${lead.title ? `, ${lead.title}` : ''} at ${lead.company || lead.domain}. Context: ${params.input.description || params.input.title || 'Outbound introduction'}.`,
        maxTokens: 300,
      })

      drafts.push({
        email: lead.email,
        name: lead.name,
        company: lead.company,
        domain: lead.domain,
        subject: `Quick question for ${lead.company || lead.domain}`,
        body: draft.output,
      })

      await supabase.rpc('record_sales_activity', {
        p_org_id: params.organizationId,
        p_activity_type: 'email_drafted',
        p_agent_id: params.agentId,
        p_task_id: params.taskId,
        p_contact_email: lead.email,
        p_contact_name: lead.name,
        p_contact_company: lead.company,
      })
    } catch (err) {
      failed.push({ email: lead.email, error: err instanceof Error ? err.message : 'draft failed' })
    }
  }

  if (params.taskId) {
    await supabase.from('tasks').update({ requires_approval: true }).eq('id', params.taskId)
  }

  const output = { leads, drafts, failed, drafted: drafts.length }
  return { output, taskOutput: output }
}

// CRM Agent: create/update a real HubSpot contact for every prospect this
// workflow run touched, and log the real outreach as a note on it.
export async function runCrmSync(
  supabase: SupabaseClient,
  params: { organizationId: string; agentId: string; taskId: string | null }
): Promise<SalesActionResult> {
  const { leads, sentEmails } = await getWorkflowRunContext(supabase, params.taskId)
  if (leads.length === 0) {
    throw new Error('No enriched leads found from an earlier "Research Prospect" step in this workflow run')
  }

  const crm = await getCrmProvider(supabase, params.organizationId)
  const sentByEmail = new Map(sentEmails.map((s) => [s.email, s]))
  const synced: { email: string; contactId: string; emailed: boolean }[] = []
  const failed: { email: string; error: string }[] = []

  for (const lead of leads) {
    // One contact hitting a HubSpot outage/rate-limit must not lose every
    // other contact's sync in the same batch.
    try {
      const [firstName, ...rest] = (lead.name || '').split(' ')
      const lastName = rest.join(' ') || undefined

      let contactId = await crm.findContactByEmail(lead.email)
      if (!contactId) {
        contactId = await crm.createContact({ email: lead.email, firstName: firstName || undefined, lastName, company: lead.company, jobTitle: lead.title })
      } else {
        await crm.updateContact(contactId, { firstName: firstName || undefined, lastName, company: lead.company, jobTitle: lead.title })
      }

      const sentRecord = sentByEmail.get(lead.email)
      if (sentRecord) {
        await crm.logNote(contactId, `Outbound email sent via AI Workforce Network on ${sentRecord.sentAt}.`)
      }

      synced.push({ email: lead.email, contactId, emailed: !!sentRecord })
    } catch (err) {
      failed.push({ email: lead.email, error: err instanceof Error ? err.message : 'CRM sync failed' })
    }
  }

  if (synced.length === 0 && failed.length > 0) {
    throw new Error(`Could not sync any of ${failed.length} contact(s) to HubSpot: ${failed[0].error}`)
  }

  const output = { synced, failed, contacts_synced: synced.length }
  return { output, taskOutput: output }
}

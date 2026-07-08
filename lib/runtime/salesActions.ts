import { SupabaseClient } from '@supabase/supabase-js'
import { getCrmProvider, getEmailProvider, getProspectProvider } from '@/lib/integrations'
import { getProvider, ModelProviderName } from '@/lib/providers'

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

function extractDomains(text: string): string[] {
  const matches = text.match(/\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,}\b/gi) || []
  return Array.from(new Set(matches.map((m) => m.toLowerCase())))
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

  for (const domain of domains) {
    const enriched = await provider.enrichDomain(domain)
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

  const output = { leads, domains_searched: domains, leads_found: leads.length }
  return { output, taskOutput: output }
}

// Outreach Agent: draft (LLM) and actually send (Gmail) a personalized
// email to every real lead the research step found.
export async function runEmailOutreach(
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

  const emailProvider = await getEmailProvider(supabase, params.organizationId)
  const model = getProvider(params.llmProvider)

  const sent: SentEmailRecord[] = []
  const failed: { email: string; error: string }[] = []

  for (const lead of leads) {
    try {
      const draft = await model.generate({
        systemPrompt: `You are ${params.agentName}, a warm and concise B2B outbound copywriter. Write a short (under 120 words) personalized cold email. Reference the recipient's real name, title, and company where known. No generic filler. Respond with the email body only, no subject line, no preamble.`,
        userPrompt: `Recipient: ${lead.name || 'there'}${lead.title ? `, ${lead.title}` : ''} at ${lead.company || lead.domain}. Context: ${params.input.description || params.input.title || 'Outbound introduction'}.`,
        maxTokens: 300,
      })

      const subject = `Quick question for ${lead.company || lead.domain}`
      const result = await emailProvider.sendEmail({ to: lead.email, subject, body: draft.output })

      const record: SentEmailRecord = { email: lead.email, name: lead.name, messageId: result.messageId, threadId: result.threadId, sentAt: new Date().toISOString() }
      sent.push(record)

      await supabase.rpc('record_sales_activity', {
        p_org_id: params.organizationId,
        p_activity_type: 'email_sent',
        p_agent_id: params.agentId,
        p_task_id: params.taskId,
        p_contact_email: lead.email,
        p_contact_name: lead.name,
        p_contact_company: lead.company,
        p_metadata: { messageId: result.messageId, threadId: result.threadId, subject },
      })
    } catch (err) {
      failed.push({ email: lead.email, error: err instanceof Error ? err.message : 'send failed' })
    }
  }

  const output = { leads, sent, failed, emails_sent: sent.length }
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

  for (const lead of leads) {
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
  }

  const output = { synced, contacts_synced: synced.length }
  return { output, taskOutput: output }
}

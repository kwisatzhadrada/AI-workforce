import { SupabaseClient } from '@supabase/supabase-js'

export type SetupWizardStep = {
  key: string
  label: string
  done: boolean
  detail: string
  actionLabel: string
  actionHref: string
}

export type SetupWizardState = {
  steps: SetupWizardStep[]
  completedCount: number
  totalCount: number
}

// Reads existing state only — organization_integrations, organization_goals,
// goal_plans, tasks — and composes it into a checklist. Every "action" link
// points at an existing tab/page (Integrations, Goals). Nothing here writes
// anything or introduces a new capability.
export async function getSetupWizardState(supabase: SupabaseClient, organizationId: string): Promise<SetupWizardState> {
  const [{ data: integrations }, { data: leadsGoal }] = await Promise.all([
    supabase.from('organization_integrations').select('provider, status').eq('organization_id', organizationId),
    supabase.from('organization_goals').select('id, status').eq('organization_id', organizationId).eq('title', 'Generate Leads').maybeSingle(),
  ])

  const connected = new Set((integrations || []).filter((i) => i.status === 'connected').map((i) => i.provider))

  let planApproved = false
  if (leadsGoal) {
    const { data: plan } = await supabase
      .from('goal_plans')
      .select('id, status')
      .eq('goal_id', leadsGoal.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    planApproved = plan?.status === 'approved'
  }

  // "Has any real work started" — any task exists for this org at all.
  const { count: anyTaskCount } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
  const tasksStarted = (anyTaskCount || 0) > 0

  const steps: SetupWizardStep[] = [
    {
      key: 'gmail',
      label: 'Connect Gmail',
      done: connected.has('gmail'),
      detail: 'The Outreach Agent needs this to actually send email.',
      actionLabel: 'Connect',
      actionHref: `/organizations/${organizationId}?tab=integrations`,
    },
    {
      key: 'hubspot',
      label: 'Connect HubSpot',
      done: connected.has('hubspot'),
      detail: 'The CRM Agent needs this to create and update real contacts.',
      actionLabel: 'Connect',
      actionHref: `/organizations/${organizationId}?tab=integrations`,
    },
    {
      key: 'hunter',
      label: 'Connect Hunter.io',
      done: connected.has('hunter'),
      detail: 'The Lead Research Agent needs this to enrich target domains into real people.',
      actionLabel: 'Connect',
      actionHref: `/organizations/${organizationId}?tab=integrations`,
    },
    {
      key: 'goal_plan',
      label: 'Approve a "Generate Leads" plan with target domains',
      done: planApproved,
      detail: 'The plan\'s "Research Prospect" step description must name real target company domains (e.g. "Enrich: acme.com, beta.io").',
      actionLabel: leadsGoal ? 'Open goal' : 'Go to Goals',
      actionHref: leadsGoal ? `/goals/${leadsGoal.id}` : `/goals?org_id=${organizationId}`,
    },
    {
      key: 'run',
      label: 'Run the campaign',
      done: tasksStarted && planApproved,
      detail: 'Open each generated task and run its capability — Research, then Outreach, then CRM Sync.',
      actionLabel: 'Open Tasks',
      actionHref: `/tasks?org_id=${organizationId}`,
    },
  ]

  return { steps, completedCount: steps.filter((s) => s.done).length, totalCount: steps.length }
}

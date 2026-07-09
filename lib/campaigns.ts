import { SupabaseClient } from '@supabase/supabase-js'
import { getProvider, ModelProviderName, ProviderConfigError } from '@/lib/providers'
import { GoalPlan, OrganizationGoal, SalesMetrics, Task } from '@/lib/types'
import { extractDomains as parseDomains } from '@/lib/utils'

const CAMPAIGN_GOAL_TITLE = 'Generate Leads'

export type CampaignIcp = {
  targetIndustry: string
  companySize: string
  location: string
  icpDescription: string
}

export type LaunchCampaignParams = CampaignIcp & {
  organizationId: string
  createdBy: string
  domains?: string
  provider?: ModelProviderName
}

export type LaunchCampaignResult = {
  goalId: string | null
  domains: string[]
  domainsSource: 'user' | 'ai_suggested' | null
  error: string | null
}

// This is the one place "the system automatically finds prospects" meets
// a real limitation: Hunter.io's Domain Search (the only prospect
// provider this platform has) enriches a KNOWN domain into real people —
// it cannot discover companies from an industry/size/location
// description; that needs a paid firmographic API (Apollo, Clearbit
// Discovery, ZoomInfo), which is out of scope here (new integration, new
// cost, not requested). So when the user doesn't paste real domains
// themselves, this asks the existing LLM provider to brainstorm a
// candidate list — clearly labeled 'ai_suggested' everywhere it's shown,
// never presented as verified data. Real, verified people only start
// existing once Hunter actually enriches one of these domains.
async function resolveDomains(icp: CampaignIcp, domainsInput: string | undefined, provider: ModelProviderName): Promise<{ domains: string[]; source: 'user' | 'ai_suggested' }> {
  const pasted = parseDomains(domainsInput || '')
  if (pasted.length > 0) return { domains: pasted, source: 'user' }

  const model = getProvider(provider)
  const response = await model.generate({
    systemPrompt:
      'You suggest real, plausible company domains that fit a target customer profile, for a sales rep to research further. Respond with ONLY a comma-separated list of 8-10 domains (e.g. acme.com, beta.io) — no company names, no explanation, no numbering.',
    userPrompt: `Industry: ${icp.targetIndustry || 'any'}. Company size: ${icp.companySize || 'any'}. Location: ${icp.location || 'any'}. Ideal customer profile: ${icp.icpDescription || 'none given'}.`,
    maxTokens: 200,
  })

  const domains = parseDomains(response.output)
  if (domains.length === 0) {
    throw new Error('The AI could not suggest any candidate domains from this description — try pasting real target company domains instead')
  }
  return { domains, source: 'ai_suggested' }
}

export async function launchCampaign(supabase: SupabaseClient, params: LaunchCampaignParams): Promise<LaunchCampaignResult> {
  const { data: existingGoal } = await supabase
    .from('organization_goals')
    .select('id, manager_agent_id')
    .eq('organization_id', params.organizationId)
    .eq('title', CAMPAIGN_GOAL_TITLE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let goalId = existingGoal?.id as string | undefined
  let managerAgentId = existingGoal?.manager_agent_id as string | null | undefined

  if (!goalId) {
    // deploy_workforce_template() (Phase 9/10) already creates a "Generate
    // Leads" goal with its manager_agent_id set for any org deployed from
    // the B2B Sales Team template — so this branch is only reached for an
    // org that wasn't deployed that way. Reuse any other goal's manager
    // (every goal from the same deployment shares one manager agent)
    // rather than guessing — there's no reliable "is this agent the
    // manager" signal left on the deployed `agents` row itself (only the
    // blueprint carries `is_manager`/`workflow_role`, and deployment
    // doesn't copy either onto the instance).
    const { data: anyGoal } = await supabase
      .from('organization_goals')
      .select('manager_agent_id')
      .eq('organization_id', params.organizationId)
      .not('manager_agent_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (!anyGoal?.manager_agent_id) {
      return { goalId: null, domains: [], domainsSource: null, error: 'This organization has no manager agent yet — deploy the B2B Sales Team workforce first' }
    }

    const { data: goal, error: goalError } = await supabase
      .from('organization_goals')
      .insert({
        organization_id: params.organizationId,
        created_by: params.createdBy,
        title: CAMPAIGN_GOAL_TITLE,
        description: params.icpDescription || null,
        priority: 'high',
        manager_agent_id: anyGoal.manager_agent_id,
      })
      .select('id, manager_agent_id')
      .single()

    if (goalError || !goal) return { goalId: null, domains: [], domainsSource: null, error: goalError?.message || 'Could not create campaign goal' }
    goalId = goal.id
    managerAgentId = goal.manager_agent_id
  }

  if (!managerAgentId || !goalId) {
    return { goalId: goalId || null, domains: [], domainsSource: null, error: 'This organization has no manager agent to run the campaign — deploy the B2B Sales Team workforce first' }
  }
  const resolvedGoalId: string = goalId

  let domains: string[]
  let domainsSource: 'user' | 'ai_suggested'
  try {
    const resolved = await resolveDomains(params, params.domains, params.provider || 'openai')
    domains = resolved.domains
    domainsSource = resolved.source
  } catch (err) {
    const message = err instanceof ProviderConfigError ? 'No AI provider is configured, and no domains were pasted — paste a few real target company domains to continue' : err instanceof Error ? err.message : 'Could not determine target domains'
    return { goalId: resolvedGoalId, domains: [], domainsSource: null, error: message }
  }

  const contextLine = [params.targetIndustry, params.companySize, params.location].filter(Boolean).join(' · ')

  const { data: plan, error: planError } = await supabase
    .from('goal_plans')
    .insert({ goal_id: resolvedGoalId, status: 'draft', generated_by: 'human', created_by: params.createdBy })
    .select('id')
    .single()

  if (planError || !plan) return { goalId: resolvedGoalId, domains, domainsSource, error: planError?.message || 'Could not create campaign plan' }

  const steps = [
    {
      plan_id: plan.id,
      step_order: 1,
      title: 'Research Prospect',
      description: `Enrich target market: ${domains.join(', ')}. ${contextLine ? `Context: ${contextLine}.` : ''}`,
    },
    {
      plan_id: plan.id,
      step_order: 2,
      title: 'Outreach',
      description: params.icpDescription || contextLine || 'Personalized outbound introduction',
    },
    { plan_id: plan.id, step_order: 3, title: 'Update CRM', description: 'Sync contacted leads into the CRM' },
  ]

  const { error: stepsError } = await supabase.from('goal_plan_steps').insert(steps)
  if (stepsError) return { goalId: resolvedGoalId, domains, domainsSource, error: stepsError.message }

  const { error: approveError } = await supabase.rpc('approve_goal_plan', { p_plan_id: plan.id })
  if (approveError) return { goalId: resolvedGoalId, domains, domainsSource, error: approveError.message }

  // Analytics funnel event — a real campaign is now running, not just a
  // goal row. Failure here shouldn't fail the whole launch (the campaign
  // itself succeeded); it's a best-effort tracking call.
  await supabase.rpc('record_campaign_launched', { p_org_id: params.organizationId, p_metadata: { domains_source: domainsSource, domain_count: domains.length } })

  return { goalId: resolvedGoalId, domains, domainsSource, error: null }
}

export type CampaignStageKey = 'research' | 'outreach' | 'crm'

export type CampaignStage = {
  key: CampaignStageKey
  label: string
  task: Task | null
  agentId: string | null
  agentName: string | null
  capabilityId: string | null
  capabilityName: string | null
}

export type CampaignState = {
  goal: OrganizationGoal | null
  plan: GoalPlan | null
  stages: CampaignStage[]
  metrics: SalesMetrics | null
}

const STAGE_DEFS: { key: CampaignStageKey; title: string; label: string }[] = [
  { key: 'research', title: 'Research Prospect', label: 'Find & Enrich Prospects' },
  { key: 'outreach', title: 'Outreach', label: 'Draft & Send Outreach' },
  { key: 'crm', title: 'Update CRM', label: 'Sync to CRM' },
]

export async function getCampaignState(supabase: SupabaseClient, organizationId: string): Promise<CampaignState> {
  const { data: goal } = await supabase
    .from('organization_goals')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('title', CAMPAIGN_GOAL_TITLE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!goal) return { goal: null, plan: null, stages: [], metrics: null }

  const { data: plan } = await supabase
    .from('goal_plans')
    .select('*, goal_plan_steps(*)')
    .eq('goal_id', goal.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const stages: CampaignStage[] = []
  for (const def of STAGE_DEFS) {
    const step = plan?.goal_plan_steps?.find((s: { title: string }) => s.title === def.title)
    let task: Task | null = null
    if (step?.task_id) {
      const { data } = await supabase.from('tasks').select('*').eq('id', step.task_id).maybeSingle()
      task = data as Task | null
    }

    let agentId: string | null = null
    let agentName: string | null = null
    let capabilityId: string | null = null
    let capabilityName: string | null = null
    if (task?.assigned_agent_id) {
      agentId = task.assigned_agent_id
      const { data: agent } = await supabase.from('agents').select('name').eq('id', agentId).maybeSingle()
      agentName = agent?.name || null
      const { data: capability } = await supabase
        .from('agent_capabilities')
        .select('id, name')
        .eq('agent_id', agentId)
        .eq('enabled', true)
        .not('integration_action', 'is', null)
        .limit(1)
        .maybeSingle()
      capabilityId = capability?.id || null
      capabilityName = capability?.name || null
    }

    stages.push({ key: def.key, label: def.label, task, agentId, agentName, capabilityId, capabilityName })
  }

  const { data: metrics } = await supabase.rpc('get_sales_metrics', { p_org_id: organizationId }).single()

  return { goal: goal as OrganizationGoal, plan: (plan as GoalPlan) || null, stages, metrics: (metrics as SalesMetrics) || null }
}

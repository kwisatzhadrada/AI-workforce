import { SupabaseClient } from '@supabase/supabase-js'
import { getProvider, ModelProviderName } from '@/lib/providers'

type DraftStep = {
  title: string
  description?: string
  department?: string | null
  estimated_effort_hours?: number
  depends_on?: number[]
}

export type GeneratePlanResult = { planId: string | null; error: string | null }

// Calls the LLM to decompose a goal into an ordered, dependency-aware plan,
// then persists it as a draft (goal_plans.generated_by = 'ai') for a human
// to review, edit, and approve — the model drafts, it doesn't get to act.
export async function generateGoalPlan(
  supabase: SupabaseClient,
  params: { goalId: string; createdBy: string; provider?: ModelProviderName }
): Promise<GeneratePlanResult> {
  const { data: goal, error: goalError } = await supabase
    .from('organization_goals')
    .select('id, organization_id, title, description, target_metrics')
    .eq('id', params.goalId)
    .maybeSingle()
  if (goalError || !goal) {
    return { planId: null, error: goalError?.message || 'Goal not found' }
  }

  const { data: departments } = await supabase
    .from('organization_departments')
    .select('id, name')
    .eq('organization_id', goal.organization_id)
  const departmentNames = (departments || []).map((d) => d.name)
  const departmentIdLookup = new Map((departments || []).map((d) => [d.name, d.id]))

  const systemPrompt = [
    'You are a planning engine for an organization of AI worker agents.',
    'Decompose the given goal into a short, ordered list of concrete steps.',
    `Each step should be assignable to one of these departments if relevant: ${departmentNames.join(', ') || '(none defined)'}.`,
    'Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:',
    '{"steps": [{"title": string, "description": string, "department": string|null, "estimated_effort_hours": number, "depends_on": number[]}]}',
    '"depends_on" is a list of zero-based indices into the same steps array for prerequisite steps. Keep it to 3-8 steps.',
  ].join(' ')

  const userPrompt = [
    `Goal: ${goal.title}`,
    goal.description ? `Description: ${goal.description}` : '',
    Object.keys(goal.target_metrics || {}).length > 0 ? `Target metrics: ${JSON.stringify(goal.target_metrics)}` : '',
  ].filter(Boolean).join('\n')

  let steps: DraftStep[]
  try {
    const provider = getProvider(params.provider || 'openai')
    const response = await provider.generate({ systemPrompt, userPrompt, maxTokens: 1500 })
    steps = parseDraftSteps(response.output)
  } catch (err) {
    return { planId: null, error: err instanceof Error ? err.message : 'Plan generation failed' }
  }

  if (steps.length === 0) {
    return { planId: null, error: 'The model did not return any usable steps' }
  }

  const { data: plan, error: planError } = await supabase
    .from('goal_plans')
    .insert({ goal_id: params.goalId, created_by: params.createdBy, generated_by: 'ai' })
    .select('id')
    .single()
  if (planError || !plan) {
    return { planId: null, error: planError?.message || 'Failed to create plan' }
  }

  const stepIds: string[] = []
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    const { data: stepRow, error: stepError } = await supabase
      .from('goal_plan_steps')
      .insert({
        plan_id: plan.id,
        step_order: i + 1,
        title: s.title,
        description: s.description || null,
        department_id: s.department ? departmentIdLookup.get(s.department) || null : null,
        estimated_effort_hours: s.estimated_effort_hours ?? null,
      })
      .select('id')
      .single()

    if (stepError || !stepRow) {
      return { planId: plan.id, error: `Created plan but failed on step ${i + 1}: ${stepError?.message}` }
    }
    stepIds.push(stepRow.id)
  }

  const dependencyRows: { step_id: string; depends_on_step_id: string }[] = []
  steps.forEach((s, i) => {
    for (const depIndex of s.depends_on || []) {
      if (depIndex >= 0 && depIndex < stepIds.length && depIndex !== i) {
        dependencyRows.push({ step_id: stepIds[i], depends_on_step_id: stepIds[depIndex] })
      }
    }
  })
  if (dependencyRows.length > 0) {
    await supabase.from('goal_plan_step_dependencies').insert(dependencyRows)
  }

  return { planId: plan.id, error: null }
}

function parseDraftSteps(rawOutput: string): DraftStep[] {
  const cleaned = rawOutput.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Model response was not valid JSON')
  }
  const steps = (parsed as { steps?: unknown })?.steps
  if (!Array.isArray(steps)) {
    throw new Error('Model response did not contain a "steps" array')
  }
  return steps
    .filter((s): s is DraftStep => typeof s === 'object' && s !== null && typeof (s as DraftStep).title === 'string')
    .slice(0, 12)
}

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgentDecision, GoalPlan, GoalPlanStep } from '@/lib/types'
import { formatTimeAgo, getAssignmentPriorityColor, getGoalStatusColor, getInitials } from '@/lib/utils'
import GoalOverrideControls from '@/components/goals/GoalOverrideControls'
import CreatePlanControls from '@/components/goals/CreatePlanControls'
import PlanCard from '@/components/goals/PlanCard'
import DecisionLogPanel from '@/components/goals/DecisionLogPanel'

export const dynamic = 'force-dynamic'

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: goal } = await supabase
    .from('organization_goals')
    .select('*, agents(id, name, avatar_url)')
    .eq('id', id)
    .maybeSingle()

  if (!goal) notFound()

  const [{ data: isSupervisor }, { data: plans }, { data: departments }, { data: assignedAgents }, decisionsResult] = await Promise.all([
    supabase.rpc('is_org_supervisor', { p_org_id: goal.organization_id, p_user_id: user.id }),
    supabase.from('goal_plans').select('*, goal_plan_steps(*, organization_departments(id, name))').eq('goal_id', id).order('created_at', { ascending: false }),
    supabase.from('organization_departments').select('id, name').eq('organization_id', goal.organization_id).order('name'),
    supabase.from('agent_assignments').select('agents(id, name)').eq('organization_id', goal.organization_id).eq('status', 'active'),
    goal.manager_agent_id
      ? supabase.from('agent_decisions').select('*').eq('agent_id', goal.manager_agent_id).order('created_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
  ])

  const managerAgentOptions = Array.from(
    new Map(((assignedAgents || []) as unknown as { agents: { id: string; name: string } | null }[])
      .filter((r) => r.agents)
      .map((r) => [r.agents!.id, r.agents!])
    ).values()
  )

  // Attach each step's dependency step-ids for display.
  const allStepIds = ((plans || []) as GoalPlan[]).flatMap((p) => (p.goal_plan_steps || []).map((s) => s.id))
  const { data: deps } = allStepIds.length > 0
    ? await supabase.from('goal_plan_step_dependencies').select('step_id, depends_on_step_id').in('step_id', allStepIds)
    : { data: [] }
  const depsByStep = new Map<string, string[]>()
  for (const d of deps || []) {
    depsByStep.set(d.step_id, [...(depsByStep.get(d.step_id) || []), d.depends_on_step_id])
  }
  const plansWithDeps = ((plans || []) as GoalPlan[]).map((p) => ({
    ...p,
    goal_plan_steps: (p.goal_plan_steps || []).map((s: GoalPlanStep) => ({ ...s, depends_on: depsByStep.get(s.id) || [] })),
  }))

  const canManage = !!isSupervisor
  const isOverdue = goal.deadline && new Date(goal.deadline) < new Date() && goal.status === 'active'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/goals?org_id=${goal.organization_id}`} className="text-sm text-[#8A88A8] hover:text-[#EDEAF8]">← All goals</Link>
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="font-['Space_Grotesk'] text-xl font-bold text-[#EDEAF8]">{goal.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-md border ${getAssignmentPriorityColor(goal.priority)}`}>{goal.priority}</span>
            <span className={`text-xs px-2 py-0.5 rounded-md border ${getGoalStatusColor(goal.status)}`}>{goal.status}</span>
            {goal.is_paused && <span className="text-xs px-2 py-0.5 rounded-md border text-yellow-400 bg-yellow-400/10 border-yellow-400/20">paused</span>}
          </div>
        </div>

        {goal.description && <p className="text-[#EDEAF8] text-sm leading-relaxed mb-4">{goal.description}</p>}

        <div className="flex items-center gap-3 flex-wrap text-xs text-[#8A88A8] mb-3">
          {goal.agents ? (
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#6D28D9] inline-flex items-center justify-center text-[10px] font-semibold text-white">{getInitials(goal.agents.name)}</span>
              Manager: <Link href={`/agent/${goal.agents.id}`} className="hover:underline text-[#EDEAF8]">{goal.agents.name}</Link>
            </span>
          ) : (
            <span className="text-yellow-400">No manager agent assigned yet</span>
          )}
          {goal.deadline && <span className={isOverdue ? 'text-red-400' : ''}>· deadline {formatTimeAgo(goal.deadline)}{isOverdue ? ' (overdue)' : ''}</span>}
          <span>· created {formatTimeAgo(goal.created_at)}</span>
        </div>

        {Object.keys(goal.target_metrics || {}).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(goal.target_metrics as Record<string, unknown>).map(([k, v]) => (
              <span key={k} className="text-xs px-2 py-1 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                {k}: <span className="text-[#EDEAF8] font-medium">{String(v)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {canManage && <GoalOverrideControls goal={goal} managerAgentOptions={managerAgentOptions} />}

      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Plan</h2>

      {canManage && <CreatePlanControls goalId={id} currentUserId={user.id} />}

      {plansWithDeps.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10 mb-6">No plan yet. {canManage ? 'Create one above.' : ''}</div>
      ) : (
        <div className="space-y-4 mb-6">
          {plansWithDeps.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              goalId={id}
              canManage={canManage}
              hasManagerAgent={!!goal.manager_agent_id}
              departments={departments || []}
            />
          ))}
        </div>
      )}

      <DecisionLogPanel decisions={(decisionsResult.data as AgentDecision[]) || []} />
    </div>
  )
}

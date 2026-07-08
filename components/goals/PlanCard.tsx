'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { approvePlan, rejectPlan, runManagerCycle } from '@/lib/goals'
import { GoalPlan } from '@/lib/types'
import { formatTimeAgo, getPlanStatusColor, getTaskStatusColor } from '@/lib/utils'
import PlanStepBuilder from './PlanStepBuilder'

export default function PlanCard({
  plan,
  goalId,
  canManage,
  hasManagerAgent,
  departments,
}: {
  plan: GoalPlan
  goalId: string
  canManage: boolean
  hasManagerAgent: boolean
  departments: { id: string; name: string }[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = (plan.goal_plan_steps || []).slice().sort((a, b) => a.step_order - b.step_order)
  const stepOrderById = new Map(steps.map((s) => [s.id, s.step_order]))

  async function approve() {
    setBusy(true)
    setError(null)
    const { error } = await approvePlan(supabase, plan.id)
    setBusy(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function reject() {
    setBusy(true)
    setError(null)
    const { error } = await rejectPlan(supabase, plan.id)
    setBusy(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function runCycle() {
    setBusy(true)
    setError(null)
    const { error } = await runManagerCycle(supabase, goalId)
    setBusy(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-md border ${getPlanStatusColor(plan.status)}`}>{plan.status}</span>
          <span className="text-xs text-[#8A88A8]">{plan.generated_by === 'ai' ? '✨ AI-generated' : 'Human-authored'} · {formatTimeAgo(plan.created_at)}</span>
        </div>
        {canManage && plan.status === 'draft' && (
          <div className="flex gap-2">
            <button onClick={approve} disabled={busy || steps.length === 0} className="text-xs text-green-400 border border-green-500/20 bg-green-500/10 px-2 py-1 rounded-lg disabled:opacity-50">
              Approve
            </button>
            <button onClick={reject} disabled={busy} className="text-xs text-red-400 border border-red-500/20 bg-red-500/10 px-2 py-1 rounded-lg disabled:opacity-50">
              Reject
            </button>
          </div>
        )}
        {canManage && plan.status === 'approved' && (
          <button onClick={runCycle} disabled={busy || !hasManagerAgent} className="text-xs bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium">
            {busy ? 'Running...' : '⚙ Run Manager Cycle'}
          </button>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-3 text-sm">{error}</div>}

      {steps.length === 0 ? (
        <div className="text-sm text-[#8A88A8] mb-3">No steps yet.</div>
      ) : (
        <div className="space-y-2 mb-3">
          {steps.map((s) => (
            <div key={s.id} className="bg-[#121428] rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-[#EDEAF8]">{s.step_order}. {s.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md border ${getTaskStatusColor(s.status === 'in_progress' ? 'in_progress' : s.status)}`}>{s.status.replace('_', ' ')}</span>
              </div>
              {s.description && <p className="text-xs text-[#8A88A8] mt-1">{s.description}</p>}
              <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-[#8A88A8]">
                {s.organization_departments && <span>{s.organization_departments.name}</span>}
                {s.estimated_effort_hours != null && <span>· {s.estimated_effort_hours}h est.</span>}
                {s.depends_on && s.depends_on.length > 0 && (
                  <span>· depends on step{s.depends_on.length > 1 ? 's' : ''} {s.depends_on.map((id) => stepOrderById.get(id)).filter(Boolean).join(', ')}</span>
                )}
                {s.task_id && <Link href={`/tasks/${s.task_id}`} className="text-[#8B5CF6] hover:underline">· view task</Link>}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && plan.status === 'draft' && (
        <PlanStepBuilder planId={plan.id} existingSteps={steps.map((s) => ({ id: s.id, step_order: s.step_order, title: s.title }))} departments={departments} />
      )}
    </div>
  )
}

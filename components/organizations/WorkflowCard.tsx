'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addWorkflowStep, startWorkflowRun } from '@/lib/organizations'
import { OrganizationDepartment, Workflow } from '@/lib/types'
import { getWorkflowStatusColor } from '@/lib/utils'

export default function WorkflowCard({
  workflow,
  departments,
  orgAgents,
  isManager,
}: {
  workflow: Workflow
  departments: OrganizationDepartment[]
  orgAgents: { id: string; name: string }[]
  isManager: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [showStepForm, setShowStepForm] = useState(false)
  const [stepName, setStepName] = useState('')
  const [stepDepartmentId, setStepDepartmentId] = useState('')
  const [stepAgentId, setStepAgentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = (workflow.workflow_steps || []).slice().sort((a, b) => a.step_order - b.step_order)

  async function addStep(e: React.FormEvent) {
    e.preventDefault()
    if (!stepName.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await addWorkflowStep(supabase, workflow.id, {
      stepOrder: steps.length + 1,
      name: stepName,
      departmentId: stepDepartmentId || null,
      agentId: stepAgentId || null,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setStepName('')
    setStepDepartmentId('')
    setStepAgentId('')
    setShowStepForm(false)
    router.refresh()
  }

  async function start() {
    setStarting(true)
    setError(null)
    const { error } = await startWorkflowRun(supabase, workflow.id)
    setStarting(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  const selectCls = 'bg-[#0C0D22] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#6D28D9]'

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#EDEAF8]">{workflow.name}</h3>
          {workflow.description && <p className="text-xs text-[#8A88A8] mt-0.5">{workflow.description}</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-md border ${getWorkflowStatusColor(workflow.status)}`}>{workflow.status}</span>
      </div>

      {error && <div className="text-red-400 text-xs mb-2">{error}</div>}

      {steps.length === 0 ? (
        <div className="text-sm text-[#8A88A8] my-3">No steps yet.</div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap my-3">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-md bg-[#121428] border border-[#3C3A58] text-[#EDEAF8]">
                {s.step_order}. {s.name}
              </span>
              {i < steps.length - 1 && <span className="text-[#3C3A58]">→</span>}
            </div>
          ))}
        </div>
      )}

      {isManager && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowStepForm((v) => !v)} className="text-xs text-[#8B5CF6] hover:text-[#6D28D9]">
            {showStepForm ? 'Cancel' : '+ Add Step'}
          </button>
          {steps.length > 0 && (
            <button onClick={start} disabled={starting} className="text-xs bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium">
              {starting ? 'Starting...' : '▶ Start Run'}
            </button>
          )}
        </div>
      )}

      {showStepForm && (
        <form onSubmit={addStep} className="flex flex-wrap gap-2 items-end mt-3 bg-[#121428] rounded-xl p-3">
          <input
            className="bg-[#0C0D22] border border-[#3C3A58] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#6D28D9] flex-1 min-w-[140px]"
            value={stepName}
            onChange={(e) => setStepName(e.target.value)}
            placeholder="Step name (e.g. Research Agent)"
            maxLength={100}
          />
          <select className={selectCls} value={stepDepartmentId} onChange={(e) => setStepDepartmentId(e.target.value)}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className={selectCls} value={stepAgentId} onChange={(e) => setStepAgentId(e.target.value)}>
            <option value="">No specific agent</option>
            {orgAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
            {saving ? 'Adding...' : 'Add'}
          </button>
        </form>
      )}
    </div>
  )
}

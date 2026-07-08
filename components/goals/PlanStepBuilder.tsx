'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addPlanStep } from '@/lib/goals'

type ExistingStep = { id: string; step_order: number; title: string }

export default function PlanStepBuilder({
  planId,
  existingSteps,
  departments,
}: {
  planId: string
  existingSteps: ExistingStep[]
  departments: { id: string; name: string }[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [effortHours, setEffortHours] = useState('')
  const [dependsOn, setDependsOn] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'bg-[#0C0D22] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm'

  function toggleDependency(stepId: string) {
    setDependsOn((prev) => (prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await addPlanStep(supabase, planId, {
      stepOrder: existingSteps.length + 1,
      title,
      description,
      departmentId: departmentId || null,
      estimatedEffortHours: effortHours ? Number(effortHours) : null,
      dependsOnStepIds: dependsOn,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setTitle('')
    setDescription('')
    setDepartmentId('')
    setEffortHours('')
    setDependsOn([])
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="bg-[#121428] rounded-xl p-4 space-y-3">
      {error && <div className="text-red-400 text-xs">{error}</div>}
      <input className={`${inputCls} w-full`} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Step title (e.g. Research prospects)" />
      <input className={`${inputCls} w-full`} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
      <div className="flex flex-wrap gap-2">
        <select className={inputCls} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">No department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="number" min="0" step="0.5" className={`${inputCls} w-32`} value={effortHours} onChange={(e) => setEffortHours(e.target.value)} placeholder="Est. hours" />
      </div>
      {existingSteps.length > 0 && (
        <div>
          <div className="text-xs text-[#8A88A8] mb-1.5">Depends on (optional):</div>
          <div className="flex flex-wrap gap-2">
            {existingSteps.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => toggleDependency(s.id)}
                className={`text-xs px-2 py-1 rounded-md border ${dependsOn.includes(s.id) ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#0C0D22] border-[#3C3A58] text-[#8A88A8]'}`}
              >
                {s.step_order}. {s.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
        {saving ? 'Adding...' : '+ Add Step'}
      </button>
    </form>
  )
}

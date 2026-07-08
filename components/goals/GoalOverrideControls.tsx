'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setGoalPaused, setGoalStatus, updateGoal } from '@/lib/goals'
import { OrganizationGoal, TaskPriority } from '@/lib/types'

export default function GoalOverrideControls({ goal, managerAgentOptions }: { goal: OrganizationGoal; managerAgentOptions: { id: string; name: string }[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [description, setDescription] = useState(goal.description || '')
  const [priority, setPriority] = useState<TaskPriority>(goal.priority)
  const [managerAgentId, setManagerAgentId] = useState(goal.manager_agent_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full bg-[#0C0D22] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm'

  async function togglePause() {
    setSaving(true)
    setError(null)
    const { error } = await setGoalPaused(supabase, goal.id, !goal.is_paused)
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function markFailed() {
    if (!confirm('Mark this goal as failed? This stops the manager agent from acting on it.')) return
    setSaving(true)
    setError(null)
    const { error } = await setGoalStatus(supabase, goal.id, 'failed')
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function saveEdits(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await updateGoal(supabase, goal.id, {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      manager_agent_id: managerAgentId || null,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setEditing(false)
    router.refresh()
  }

  if (goal.status === 'completed' || goal.status === 'failed') return null

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Human Override</h2>
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={togglePause} disabled={saving} className="text-sm text-yellow-400 border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 rounded-lg disabled:opacity-50">
          {goal.is_paused ? '▶ Resume Goal' : '⏸ Pause Goal'}
        </button>
        <button onClick={() => setEditing((v) => !v)} className="text-sm text-[#8B5CF6] border border-[#6D28D9]/30 bg-[#6D28D9]/10 px-3 py-1.5 rounded-lg">
          {editing ? 'Cancel Edit' : 'Modify Goal'}
        </button>
        <button onClick={markFailed} disabled={saving} className="text-sm text-red-400 border border-red-500/20 bg-red-500/10 px-3 py-1.5 rounded-lg disabled:opacity-50">
          Mark Failed
        </button>
      </div>

      {editing && (
        <form onSubmit={saveEdits} className="space-y-3 bg-[#121428] rounded-xl p-4">
          <input className={inputCls} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea className={`${inputCls} resize-none`} rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <div className="flex gap-2">
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select className={inputCls} value={managerAgentId} onChange={(e) => setManagerAgentId(e.target.value)}>
              <option value="">No manager agent</option>
              {managerAgentOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      )}
    </div>
  )
}

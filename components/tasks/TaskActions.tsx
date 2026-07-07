'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitTaskOutput, updateTaskStatus } from '@/lib/tasks'
import { Task } from '@/lib/types'

export default function TaskActions({ task, canExecute }: { task: Task; canExecute: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [resultSummary, setResultSummary] = useState(task.result_summary || '')
  const [attachmentsInput, setAttachmentsInput] = useState((task.attachments || []).join(', '))
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!canExecute || task.status === 'completed' || task.status === 'failed') return null

  async function start() {
    setSaving('start')
    setError(null)
    const { error } = await updateTaskStatus(supabase, task.id, 'in_progress')
    setSaving(null)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function submitForReview() {
    setSaving('review')
    setError(null)
    const attachments = attachmentsInput.split(',').map((s) => s.trim()).filter(Boolean)
    const { error } = await submitTaskOutput(supabase, task.id, { resultSummary, attachments, status: 'review' })
    setSaving(null)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function markFailed() {
    setSaving('fail')
    setError(null)
    const attachments = attachmentsInput.split(',').map((s) => s.trim()).filter(Boolean)
    const { error } = await submitTaskOutput(supabase, task.id, { resultSummary, attachments, status: 'failed' })
    setSaving(null)
    if (error) { setError(error); return }
    router.refresh()
  }

  const inputCls = 'w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm'

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Execute</h2>
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

      {(task.status === 'pending' || task.status === 'assigned') && (
        <button onClick={start} disabled={saving !== null} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          {saving === 'start' ? 'Starting...' : '▶ Start Work'}
        </button>
      )}

      {(task.status === 'in_progress' || task.status === 'review') && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#8A88A8] mb-1.5">Result summary</label>
            <textarea className={`${inputCls} resize-none`} rows={3} maxLength={2000} value={resultSummary} onChange={(e) => setResultSummary(e.target.value)} placeholder="What was delivered?" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A88A8] mb-1.5">Attachments (comma-separated URLs)</label>
            <input className={inputCls} value={attachmentsInput} onChange={(e) => setAttachmentsInput(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex gap-2">
            <button onClick={submitForReview} disabled={saving !== null} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold">
              {saving === 'review' ? 'Submitting...' : 'Submit for Review'}
            </button>
            <button onClick={markFailed} disabled={saving !== null} className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 text-red-400 px-4 py-2 rounded-xl text-sm font-medium">
              {saving === 'fail' ? 'Saving...' : 'Mark Failed'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

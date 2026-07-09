'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RunStageButton({
  agentId,
  taskId,
  capabilityId,
  taskTitle,
  taskDescription,
  label,
}: {
  agentId: string
  taskId: string
  capabilityId: string
  taskTitle: string
  taskDescription: string | null
  label: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    const res = await fetch('/api/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        task_id: taskId,
        capability_id: capabilityId,
        provider: 'openai',
        input: { title: taskTitle, description: taskDescription },
      }),
    })
    const body = await res.json().catch(() => ({}))
    setRunning(false)
    if (!res.ok) { setError(body.error || 'Failed to run'); return }
    if (body.execution?.status === 'failed') { setError(body.execution.error || 'Execution failed'); return }

    // Running an execution never flips the task's own status (Phase 4/5
    // treat that as a separate, human-owned lifecycle) — the guided
    // campaign flow closes that gap itself so the dashboard can tell a
    // finished stage from a pending one without a manual detour to the
    // task detail page.
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId)
    router.refresh()
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={running}
        className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        {running ? 'Running...' : label}
      </button>
      {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { advanceWorkflowRun } from '@/lib/organizations'
import { WorkflowRun } from '@/lib/types'
import { formatTimeAgo, getWorkflowStatusColor } from '@/lib/utils'

type RunWithStep = WorkflowRun & { current_step_name?: string | null }

export default function WorkflowRunsList({ runs, isManager }: { runs: RunWithStep[]; isManager: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function advance(runId: string, status: 'completed' | 'failed') {
    setBusyId(runId)
    setError(null)
    const { error } = await advanceWorkflowRun(supabase, runId, status)
    setBusyId(null)
    if (error) { setError(error); return }
    router.refresh()
  }

  if (runs.length === 0) {
    return <div className="text-center text-[#8A88A8] py-10">No workflow runs yet. Start one from a workflow above.</div>
  }

  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Runs</h2>
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}
      <div className="space-y-2">
        {runs.map((r) => (
          <div key={r.id} className="flex items-center gap-3 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[#EDEAF8]">{r.workflows?.name || 'Workflow'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md border ${getWorkflowStatusColor(r.status)}`}>{r.status}</span>
              </div>
              <div className="text-xs text-[#8A88A8] mt-1">
                {r.status === 'in_progress' && r.current_step_name ? `Current step: ${r.current_step_name} · ` : ''}
                started {formatTimeAgo(r.started_at)}
              </div>
            </div>
            {isManager && r.status === 'in_progress' && (
              <div className="flex gap-2 shrink-0">
                <button
                  disabled={busyId === r.id}
                  onClick={() => advance(r.id, 'completed')}
                  className="text-xs text-green-400 hover:text-green-300 border border-green-500/20 bg-green-500/10 px-2 py-1 rounded-lg disabled:opacity-50"
                >
                  Complete Step
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => advance(r.id, 'failed')}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 bg-red-500/10 px-2 py-1 rounded-lg disabled:opacity-50"
                >
                  Fail Run
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

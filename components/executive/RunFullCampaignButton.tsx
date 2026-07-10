'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type StageInput = { agentId: string; taskId: string; capabilityId: string; taskTitle: string; taskDescription: string | null }

async function runStage(stage: StageInput): Promise<void> {
  const res = await fetch('/api/executions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: stage.agentId,
      task_id: stage.taskId,
      capability_id: stage.capabilityId,
      provider: 'openai',
      input: { title: stage.taskTitle, description: stage.taskDescription },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Failed to run')
  if (body.execution?.status === 'failed') throw new Error(body.execution.error || 'Execution failed')
}

// Autonomy level 3: chain already-reachable stages into one action instead
// of requiring a click per stage. Still fully human-triggered (one click),
// and still stops at the existing human-approval gate before anything is
// ever sent — this only saves clicking "Find & Enrich Prospects" and then
// separately "Draft Outreach Emails".
export default function RunFullCampaignButton({ research, outreach }: { research: StageInput; outreach: StageInput }) {
  const supabase = createClient()
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runFull() {
    setRunning(true)
    setError(null)
    try {
      setStep('Finding & enriching prospects...')
      await runStage(research)
      await supabase.from('tasks').update({ status: 'completed' }).eq('id', research.taskId)

      setStep('Drafting outreach emails...')
      await runStage(outreach)
      await supabase.from('tasks').update({ status: 'completed' }).eq('id', outreach.taskId)

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run the full campaign')
    } finally {
      setRunning(false)
      setStep(null)
    }
  }

  return (
    <div>
      <button
        onClick={runFull}
        disabled={running}
        className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        {running ? step || 'Running...' : 'Run Full Campaign (Research + Draft)'}
      </button>
      {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
    </div>
  )
}

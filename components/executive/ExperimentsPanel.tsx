'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyExperimentWinner, concludeExperiment, createExperiment } from '@/lib/experiments'
import { Experiment } from '@/lib/types'

function ExperimentRow({ experiment, isManager }: { experiment: Experiment; isManager: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function conclude() {
    setBusy(true)
    setError(null)
    const { error } = await concludeExperiment(supabase, experiment.id)
    setBusy(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function applyWinner() {
    setBusy(true)
    setError(null)
    const { error } = await applyExperimentWinner(supabase, experiment.id)
    setBusy(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <span className="text-xs px-2 py-0.5 rounded-md border capitalize text-[#8A88A8] bg-[#0C0D22] border-[#3C3A58]">
          {experiment.status}
        </span>
        {experiment.winner && (
          <span className="text-xs px-2 py-0.5 rounded-md border text-green-400 bg-green-400/10 border-green-400/20">
            Winner: Variant {experiment.winner === 'tie' ? '— tie' : experiment.winner.toUpperCase()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[#EDEAF8]">A: &ldquo;{experiment.variant_a.subject_line}&rdquo;</div>
          {experiment.variant_a.reply_rate !== undefined && (
            <div className="text-xs text-[#8A88A8]">{experiment.variant_a.sent} sent · {experiment.variant_a.reply_rate}% reply rate</div>
          )}
        </div>
        <div>
          <div className="text-[#EDEAF8]">B: &ldquo;{experiment.variant_b.subject_line}&rdquo;</div>
          {experiment.variant_b.reply_rate !== undefined && (
            <div className="text-xs text-[#8A88A8]">{experiment.variant_b.sent} sent · {experiment.variant_b.reply_rate}% reply rate</div>
          )}
        </div>
      </div>
      {isManager && (
        <div className="flex gap-2 mt-3">
          {experiment.status === 'running' && (
            <button onClick={conclude} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white">
              {busy ? 'Concluding...' : 'Conclude Test'}
            </button>
          )}
          {experiment.status === 'concluded' && experiment.winner && experiment.winner !== 'tie' && (
            <button onClick={applyWinner} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg border border-[#3C3A58] text-[#8A88A8] hover:text-[#EDEAF8] disabled:opacity-50">
              {busy ? 'Applying...' : 'Apply Winner'}
            </button>
          )}
        </div>
      )}
      {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
    </div>
  )
}

export default function ExperimentsPanel({
  organizationId, goalId, experiments, isManager,
}: {
  organizationId: string
  goalId: string | null
  experiments: Experiment[]
  isManager: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [subjectA, setSubjectA] = useState('')
  const [subjectB, setSubjectB] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasRunning = experiments.some((e) => e.status === 'running')

  async function create() {
    if (!subjectA.trim() || !subjectB.trim()) return
    setCreating(true)
    setError(null)
    const { error } = await createExperiment(supabase, { organizationId, goalId, subjectA: subjectA.trim(), subjectB: subjectB.trim() })
    setCreating(false)
    if (error) { setError(error); return }
    setSubjectA('')
    setSubjectB('')
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-medium text-[#EDEAF8] mb-1">Subject Line A/B Tests</h3>
        <p className="text-xs text-[#8A88A8]">Use <code>{'{company}'}</code> as a placeholder — it's filled in per prospect. Winners are determined automatically from real reply rates.</p>
      </div>

      {isManager && !hasRunning && (
        <div className="space-y-2">
          <input value={subjectA} onChange={(e) => setSubjectA(e.target.value)} placeholder="Variant A subject line"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <input value={subjectB} onChange={(e) => setSubjectB(e.target.value)} placeholder="Variant B subject line"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <button onClick={create} disabled={creating || !subjectA.trim() || !subjectB.trim()}
            className="text-sm px-3 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white">
            {creating ? 'Starting...' : 'Start Test'}
          </button>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      )}

      {experiments.length === 0 ? (
        <p className="text-sm text-[#8A88A8]">No tests yet.</p>
      ) : (
        <div className="space-y-3">
          {experiments.map((e) => <ExperimentRow key={e.id} experiment={e} isManager={isManager} />)}
        </div>
      )}
    </div>
  )
}

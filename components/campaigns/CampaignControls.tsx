'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setGoalPaused, setGoalStatus } from '@/lib/goals'

export default function CampaignControls({ goalId, isPaused, status }: { goalId: string; isPaused: boolean; status: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function togglePause() {
    setBusy(true)
    setError(null)
    const { error } = await setGoalPaused(supabase, goalId, !isPaused)
    setBusy(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function stop() {
    if (!confirm('Stop this campaign? No further steps will run. This cannot be undone from here.')) return
    setBusy(true)
    setError(null)
    const { error } = await setGoalStatus(supabase, goalId, 'failed')
    setBusy(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  if (status === 'failed') {
    return <span className="text-xs px-2 py-1 rounded-md bg-gray-500/10 border border-gray-500/20 text-gray-400">Campaign stopped</span>
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={togglePause}
        disabled={busy}
        className="bg-[#121428] border border-[#3C3A58] hover:border-[#6D28D9] disabled:opacity-50 text-[#EDEAF8] px-3 py-1.5 rounded-lg text-sm font-medium"
      >
        {isPaused ? '▶ Resume Campaign' : '⏸ Pause Campaign'}
      </button>
      <button
        onClick={stop}
        disabled={busy}
        className="bg-[#121428] border border-[#3C3A58] hover:border-red-400 disabled:opacity-50 text-red-400 px-3 py-1.5 rounded-lg text-sm font-medium"
      >
        ■ Stop Campaign
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

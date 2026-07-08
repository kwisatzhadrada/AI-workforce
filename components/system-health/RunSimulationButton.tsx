'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { startSimulationRun } from '@/lib/simulation'

export default function RunSimulationButton() {
  const supabase = createClient()
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    const { error } = await startSimulationRun(supabase)
    setRunning(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        onClick={run}
        disabled={running}
        className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        {running ? 'Running simulation...' : 'Run Simulation'}
      </button>
    </div>
  )
}

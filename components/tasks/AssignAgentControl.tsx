'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { assignTaskAgent } from '@/lib/tasks'

export default function AssignAgentControl({ taskId, agentOptions }: { taskId: string; agentOptions: { id: string; name: string }[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [agentId, setAgentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function assign() {
    if (!agentId) return
    setSaving(true)
    setError(null)
    const { error } = await assignTaskAgent(supabase, taskId, agentId)
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  if (agentOptions.length === 0) {
    return <span className="text-sm text-[#8A88A8]">Unassigned · no agents in this organization yet</span>
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <select
        className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#6D28D9]"
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
      >
        <option value="">Assign to agent…</option>
        {agentOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button
        onClick={assign}
        disabled={!agentId || saving}
        className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
      >
        {saving ? 'Assigning...' : 'Assign'}
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateRecommendationsForOrganization, refreshPredictionsForOrganization } from '@/lib/intelligence'

export default function OrgScopedActionControl({
  organizations,
  action,
  label,
}: {
  organizations: { id: string; name: string }[]
  action: 'recommendations' | 'predictions'
  label: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [orgId, setOrgId] = useState(organizations[0]?.id || '')
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run() {
    if (!orgId) return
    setRunning(true)
    setMessage(null)
    const { count, error } = action === 'recommendations'
      ? await generateRecommendationsForOrganization(supabase, orgId)
      : await refreshPredictionsForOrganization(supabase, orgId)
    setRunning(false)
    if (error) { setMessage(error); return }
    setMessage(`${count ?? 0} generated`)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={orgId}
        onChange={(e) => setOrgId(e.target.value)}
        className="bg-[#121428] border border-[#3C3A58] rounded-lg text-sm px-3 py-1.5 text-[#EDEAF8]"
      >
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <button
        onClick={run}
        disabled={running || !orgId}
        className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
      >
        {running ? 'Running...' : label}
      </button>
      {message && <span className="text-xs text-[#8A88A8]">{message}</span>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setAutonomyLevel } from '@/lib/executive'
import { AutonomyLevel } from '@/lib/types'

const LEVELS: { value: AutonomyLevel; label: string; description: string }[] = [
  { value: 0, label: 'Level 0 — Manual', description: 'You control everything. No recommendations, no drafts.' },
  { value: 1, label: 'Level 1 — Recommends', description: 'The system suggests what to do next. You decide and act.' },
  { value: 2, label: 'Level 2 — Drafts', description: 'The system drafts outreach and waits for your approval before sending anything.' },
  { value: 3, label: 'Level 3 — Chains Stages', description: 'One click runs research and drafting together, instead of one stage at a time. Sending still needs your approval.' },
  { value: 4, label: 'Level 4 — Self-Optimizes', description: 'A concluded A/B test\'s winning subject line is applied automatically, without waiting for you to apply it.' },
]

export default function AutonomyLevelControl({ organizationId, level, isManager }: { organizationId: string; level: AutonomyLevel; isManager: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = LEVELS.find((l) => l.value === level) || LEVELS[2]

  async function change(newLevel: AutonomyLevel) {
    setSaving(true)
    setError(null)
    const { error } = await setAutonomyLevel(supabase, organizationId, newLevel)
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-1">Autonomy Level</h3>
      <p className="text-xs text-[#8A88A8] mb-3">{current.label}: {current.description}</p>
      {isManager ? (
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => change(l.value)}
              disabled={saving}
              className={`text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50 ${
                l.value === level ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'
              }`}
            >
              {l.value}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#8A88A8]">Only an organization manager can change this.</p>
      )}
      {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
    </div>
  )
}

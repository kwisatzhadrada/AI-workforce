'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateExecutiveBrief } from '@/lib/briefs'
import { ExecutiveBrief, ExecutiveBriefPeriod } from '@/lib/types'

const PERIOD_LABEL: Record<ExecutiveBriefPeriod, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

function Section({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div className="text-xs text-[#8A88A8] mb-1">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-[#8A88A8]">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => <li key={i} className="text-sm text-[#EDEAF8]">• {item}</li>)}
        </ul>
      )}
    </div>
  )
}

export default function ExecutiveBriefPanel({ organizationId, brief }: { organizationId: string; brief: ExecutiveBrief | null }) {
  const supabase = createClient()
  const router = useRouter()
  const [generating, setGenerating] = useState<ExecutiveBriefPeriod | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate(period: ExecutiveBriefPeriod) {
    setGenerating(period)
    setError(null)
    const { error } = await generateExecutiveBrief(supabase, organizationId, period)
    setGenerating(null)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-medium text-[#EDEAF8]">
          {brief ? `${PERIOD_LABEL[brief.period_type]} Brief` : 'Executive Brief'}
        </h3>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as ExecutiveBriefPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => generate(p)}
              disabled={generating !== null}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white"
            >
              {generating === p ? 'Generating...' : PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}

      {brief ? (
        <div className="space-y-4">
          <Section title="What Happened" items={brief.content.what_happened} empty="Nothing to report yet." />
          <Section title="What Worked" items={brief.content.what_worked} empty="No wins to report yet." />
          <Section title="What Failed" items={brief.content.what_failed} empty="Nothing failed this period." />
          <Section title="Needs Attention" items={brief.content.needs_attention} empty="Nothing needs your attention right now." />
          <Section title="Recommended Actions" items={brief.content.recommended_actions} empty="No recommendations right now." />
        </div>
      ) : (
        <p className="text-sm text-[#8A88A8]">Generate a brief above to see what happened, what worked, what failed, what needs attention, and what to do next — in plain business language.</p>
      )}
    </div>
  )
}

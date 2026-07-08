'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createPlan } from '@/lib/goals'
import { ModelProviderName } from '@/lib/types'

const PROVIDERS: { value: ModelProviderName; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'local', label: 'Local model' },
]

export default function CreatePlanControls({ goalId, currentUserId }: { goalId: string; currentUserId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [provider, setProvider] = useState<ModelProviderName>('openai')
  const [creatingManual, setCreatingManual] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createManualPlan() {
    setCreatingManual(true)
    setError(null)
    const { error } = await createPlan(supabase, goalId, currentUserId, 'human')
    setCreatingManual(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  async function generateWithAI() {
    setGenerating(true)
    setError(null)
    const res = await fetch(`/api/goals/${goalId}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    const body = await res.json().catch(() => ({}))
    setGenerating(false)
    if (!res.ok) { setError(body.error || 'Plan generation failed'); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-4">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Create a Plan</h2>
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-3 text-sm">{error}</div>}
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={createManualPlan} disabled={creatingManual} className="text-sm border border-[#3C3A58] text-[#EDEAF8] hover:border-[#6D28D9] px-4 py-2 rounded-xl disabled:opacity-50">
          {creatingManual ? 'Creating...' : '+ New Draft Plan'}
        </button>
        <select
          className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
          value={provider}
          onChange={(e) => setProvider(e.target.value as ModelProviderName)}
        >
          {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button onClick={generateWithAI} disabled={generating} className="text-sm bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium">
          {generating ? 'Generating...' : '✨ Generate with AI'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setAgentCategories } from '@/lib/registry'
import { AgentCategory } from '@/lib/types'

export default function CategoryPicker({
  agentId,
  allCategories,
  selectedIds: initialSelectedIds,
}: {
  agentId: string
  allCategories: AgentCategory[]
  selectedIds: string[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    const { error } = await setAgentCategories(supabase, agentId, Array.from(selected))
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Categories</h2>
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}
      <div className="flex flex-wrap gap-2 mb-4">
        {allCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              selected.has(c.id) ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold">
        {saving ? 'Saving...' : 'Save Categories'}
      </button>
    </div>
  )
}

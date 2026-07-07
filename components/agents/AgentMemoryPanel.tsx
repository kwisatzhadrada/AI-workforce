'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deleteMemory, upsertMemory } from '@/lib/agentRuntime'
import { AgentMemory, MemoryType } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const MEMORY_TYPES: { value: MemoryType; label: string }[] = [
  { value: 'fact', label: 'Fact' },
  { value: 'preference', label: 'Preference' },
  { value: 'learned_pattern', label: 'Learned Pattern' },
  { value: 'context', label: 'Context' },
]

export default function AgentMemoryPanel({ agentId, memories }: { agentId: string; memories: AgentMemory[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [memoryType, setMemoryType] = useState<MemoryType>('fact')
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const inputCls = 'bg-[#0C0D22] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim() || !value.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await upsertMemory(supabase, agentId, { memoryType, key, value })
    setSaving(false)
    if (error) { setError(error); return }
    setKey('')
    setValue('')
    router.refresh()
  }

  async function remove(memoryId: string) {
    setBusyId(memoryId)
    await deleteMemory(supabase, memoryId)
    setBusyId(null)
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Memory</h2>
      <p className="text-xs text-[#8A88A8] mb-4">Facts, preferences, and learned patterns this agent retains across tasks. Private to you.</p>

      {memories.length > 0 && (
        <div className="space-y-2 mb-5">
          {memories.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 bg-[#121428] rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[#0C0D22] border border-[#3C3A58] text-[#8A88A8]">{m.memory_type.replace('_', ' ')}</span>
                  <span className="text-sm text-[#EDEAF8] font-medium">{m.key}</span>
                </div>
                <div className="text-xs text-[#8A88A8] mt-1 truncate">{JSON.stringify(m.value)}</div>
                <div className="text-xs text-[#3C3A58] mt-0.5">{formatTimeAgo(m.updated_at)}</div>
              </div>
              <button disabled={busyId === m.id} onClick={() => remove(m.id)} className="text-xs text-[#8A88A8] hover:text-red-400 shrink-0">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

      <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
        <select className={inputCls} value={memoryType} onChange={(e) => setMemoryType(e.target.value as MemoryType)}>
          {MEMORY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input className={`${inputCls} flex-1 min-w-[140px]`} maxLength={100} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key (e.g. preferred_tone)" />
        <input className={`${inputCls} flex-1 min-w-[140px]`} maxLength={500} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
        <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {saving ? 'Saving...' : '+ Add'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addCapability, removeCapability, toggleCapability } from '@/lib/agentRuntime'
import { AgentCapability, CAPABILITY_EXAMPLES } from '@/lib/types'

export default function CapabilitiesPanel({ agentId, capabilities }: { agentId: string; capabilities: AgentCapability[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [costEstimate, setCostEstimate] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const inputCls = 'bg-[#0C0D22] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await addCapability(supabase, agentId, {
      name,
      description,
      costEstimate: Number(costEstimate) || 0,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setName('')
    setDescription('')
    setCostEstimate('0')
    router.refresh()
  }

  async function toggle(capabilityId: string, enabled: boolean) {
    setBusyId(capabilityId)
    await toggleCapability(supabase, capabilityId, enabled)
    setBusyId(null)
    router.refresh()
  }

  async function remove(capabilityId: string) {
    setBusyId(capabilityId)
    await removeCapability(supabase, capabilityId)
    setBusyId(null)
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Capabilities</h2>

      {capabilities.length > 0 && (
        <div className="space-y-2 mb-5">
          {capabilities.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-[#121428] rounded-lg px-3 py-2">
              <div>
                <div className="text-sm text-[#EDEAF8]">{c.name}</div>
                {c.description && <div className="text-xs text-[#8A88A8]">{c.description}</div>}
                <div className="text-xs text-[#8A88A8]">Est. cost: {c.cost_estimate} credits/run</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={busyId === c.id}
                  onClick={() => toggle(c.id, !c.enabled)}
                  className={`text-xs px-2 py-1 rounded-lg border disabled:opacity-50 ${
                    c.enabled ? 'text-green-400 border-green-500/20 bg-green-500/10' : 'text-gray-400 border-gray-400/20 bg-gray-400/10'
                  }`}
                >
                  {c.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button disabled={busyId === c.id} onClick={() => remove(c.id)} className="text-xs text-[#8A88A8] hover:text-red-400">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

      <form onSubmit={submit} className="space-y-3">
        <input className={`${inputCls} w-full`} list="capability-examples" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Capability name (e.g. Research)" />
        <datalist id="capability-examples">
          {CAPABILITY_EXAMPLES.map((c) => <option key={c} value={c} />)}
        </datalist>
        <input className={`${inputCls} w-full`} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this capability do?" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#8A88A8]">Est. cost per run (credits)</label>
          <input type="number" min="0" step="0.01" className={`${inputCls} w-28`} value={costEstimate} onChange={(e) => setCostEstimate(e.target.value)} />
        </div>
        <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          {saving ? 'Adding...' : '+ Add Capability'}
        </button>
      </form>
    </div>
  )
}

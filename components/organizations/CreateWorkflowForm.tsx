'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createWorkflow } from '@/lib/organizations'

export default function CreateWorkflowForm({ organizationId, currentUserId }: { organizationId: string; currentUserId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await createWorkflow(supabase, organizationId, currentUserId, name, description)
    setSaving(false)
    if (error) { setError(error); return }
    setName('')
    setDescription('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-4 mb-5 space-y-3">
      {error && <div className="text-red-400 text-xs">{error}</div>}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workflow name (e.g. Inbound Lead Routing)"
          maxLength={100}
        />
        <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
          {saving ? 'Creating...' : '+ New Workflow'}
        </button>
      </div>
      <input
        className="w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        maxLength={500}
      />
    </form>
  )
}

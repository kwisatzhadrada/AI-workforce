'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createDepartment } from '@/lib/organizations'
import { OrganizationDepartment } from '@/lib/types'

export default function DepartmentsPanel({
  organizationId,
  departments,
  agentCounts,
  isManager,
}: {
  organizationId: string
  departments: OrganizationDepartment[]
  agentCounts: Record<string, number>
  isManager: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await createDepartment(supabase, organizationId, name)
    setSaving(false)
    if (error) { setError(error); return }
    setName('')
    router.refresh()
  }

  return (
    <div>
      {isManager && (
        <form onSubmit={submit} className="flex gap-2 mb-5">
          <input
            className="flex-1 bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-2.5 outline-none text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Custom department name"
            maxLength={100}
          />
          <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
            {saving ? 'Adding...' : '+ Add Department'}
          </button>
        </form>
      )}
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

      <div className="grid sm:grid-cols-2 gap-3">
        {departments.map((d) => (
          <div key={d.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-[#EDEAF8]">{d.name}</div>
              {d.is_custom && <div className="text-xs text-[#8A88A8]">Custom</div>}
            </div>
            <span className="text-sm text-[#8B5CF6] font-medium">{agentCounts[d.id] || 0} agents</span>
          </div>
        ))}
      </div>
    </div>
  )
}

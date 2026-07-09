'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setAvgDealValue } from '@/lib/sales'

export default function AvgDealValueForm({ organizationId, currentValue }: { organizationId: string; currentValue: number | null }) {
  const supabase = createClient()
  const router = useRouter()
  const [value, setValue] = useState(currentValue != null ? String(currentValue) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const parsed = value.trim() === '' ? null : Number(value)
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setError('Enter a valid, non-negative number')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await setAvgDealValue(supabase, organizationId, parsed)
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <div className="text-xs text-[#8A88A8] mb-2">Average Deal Value ($) — used to estimate pipeline value from meetings booked</div>
      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 8000"
          inputMode="decimal"
          className="w-40 bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
        />
        <button
          onClick={submit}
          disabled={saving}
          className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
    </div>
  )
}

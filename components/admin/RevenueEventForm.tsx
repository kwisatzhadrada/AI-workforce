'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recordRevenueEvent } from '@/lib/revenue'
import { RevenueEventType } from '@/lib/types'

const TYPES: { value: RevenueEventType; label: string }[] = [
  { value: 'trial_started', label: 'Trial started' },
  { value: 'subscription_started', label: 'Subscription started' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'downgrade', label: 'Downgrade' },
  { value: 'subscription_cancelled', label: 'Subscription cancelled' },
]

export default function RevenueEventForm({ organizationId }: { organizationId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [eventType, setEventType] = useState<RevenueEventType>('trial_started')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    const { error } = await recordRevenueEvent(supabase, {
      organizationId,
      eventType,
      amount: amount ? Number(amount) : null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setAmount('')
    setNotes('')
    router.refresh()
  }

  return (
    <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={eventType} onChange={(e) => setEventType(e.target.value as RevenueEventType)}
          className="bg-[#0C0D22] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monthly amount ($, optional)"
          className="bg-[#0C0D22] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)"
        className="w-full bg-[#0C0D22] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
      <button onClick={submit} disabled={saving}
        className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
        {saving ? 'Saving...' : 'Log Revenue Event'}
      </button>
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}

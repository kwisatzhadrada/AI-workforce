'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { markMeetingBooked } from '@/lib/runtime/checkReplies'

export default function MarkMeetingBookedForm({ organizationId }: { organizationId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!email.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await markMeetingBooked(supabase, { organizationId, contactEmail: email.trim(), contactName: name.trim() || null })
    setSaving(false)
    if (error) { setError(error); return }
    setEmail('')
    setName('')
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
      <h3 className="text-sm font-medium text-[#EDEAF8] mb-3">📅 Log a Booked Meeting</h3>
      <p className="text-xs text-[#8A88A8] mb-3">
        Meeting scheduling isn&apos;t automated (no calendar integration yet) — log it here once a prospect confirms, so it counts toward the pipeline.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Contact email"
          className="flex-1 min-w-[160px] bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contact name (optional)"
          className="flex-1 min-w-[160px] bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
        />
        <button
          onClick={submit}
          disabled={saving || !email.trim()}
          className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {saving ? 'Saving...' : 'Log Meeting'}
        </button>
      </div>
      {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setDailySendCap } from '@/lib/billing'
import { SendEligibility } from '@/lib/types'

// The visible half of this phase's safety controls — the actual
// enforcement happens server-side in sendApprovedOutreach() regardless
// of whether this banner is ever seen, but a design partner should never
// be surprised by a send getting blocked.
export default function SendSafetyPanel({
  organizationId, eligibility, isManager,
}: {
  organizationId: string
  eligibility: SendEligibility | null
  isManager: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [cap, setCap] = useState(eligibility?.daily_cap.toString() || '50')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!eligibility) return null

  const nearCap = eligibility.daily_cap > 0 && eligibility.sent_today / eligibility.daily_cap >= 0.8
  const atOrOverCap = eligibility.sent_today >= eligibility.daily_cap

  async function saveCap() {
    const parsed = Number(cap)
    if (!Number.isFinite(parsed) || parsed < 1) return
    setSaving(true)
    setError(null)
    const { error } = await setDailySendCap(supabase, organizationId, parsed)
    setSaving(false)
    if (error) { setError(error); return }
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-sm text-[#EDEAF8]">
            {eligibility.sent_today} / {eligibility.daily_cap} emails sent today
          </span>
          {!eligibility.allowed && eligibility.reason === 'subscription_inactive' && (
            <span className="ml-2 text-xs text-red-400">Sending is paused — your trial has ended. Subscribe on the Billing tab to resume.</span>
          )}
          {atOrOverCap && eligibility.allowed !== false && (
            <span className="ml-2 text-xs text-yellow-400">Daily send cap reached — sending resumes tomorrow.</span>
          )}
          {!atOrOverCap && nearCap && (
            <span className="ml-2 text-xs text-yellow-400">Approaching today&apos;s send cap.</span>
          )}
        </div>
        {isManager && (
          <button onClick={() => setEditing((v) => !v)} className="text-xs text-[#6D28D9] hover:underline">
            {editing ? 'Cancel' : 'Adjust cap'}
          </button>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-[#121428] overflow-hidden mt-2">
        <div
          className={`h-full ${atOrOverCap ? 'bg-red-400' : nearCap ? 'bg-yellow-400' : 'bg-[#6D28D9]'}`}
          style={{ width: `${Math.min(100, Math.round((eligibility.sent_today / Math.max(1, eligibility.daily_cap)) * 100))}%` }}
        />
      </div>
      {editing && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number" min={1} max={1000} value={cap} onChange={(e) => setCap(e.target.value)}
            className="w-24 bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-2 py-1 text-sm outline-none focus:border-[#6D28D9]"
          />
          <span className="text-xs text-[#8A88A8]">emails per day</span>
          <button onClick={saveCap} disabled={saving} className="text-xs bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}

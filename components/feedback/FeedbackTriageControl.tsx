'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { bumpFeedbackFrequency, triageFeedback } from '@/lib/feedback'
import { FeedbackSeverity, FeedbackStatus } from '@/lib/types'

const STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed']
const SEVERITIES: FeedbackSeverity[] = ['low', 'medium', 'high', 'critical']

export default function FeedbackTriageControl({
  feedbackId, currentStatus, currentSeverity, currentOwnerId, admins,
}: {
  feedbackId: string
  currentStatus: FeedbackStatus
  currentSeverity: FeedbackSeverity
  currentOwnerId: string | null
  admins: { id: string; full_name: string | null }[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function apply(updates: { status?: FeedbackStatus; severity?: FeedbackSeverity; ownerId?: string }) {
    setSaving(true)
    await triageFeedback(supabase, feedbackId, updates)
    setSaving(false)
    router.refresh()
  }

  async function bump() {
    setSaving(true)
    await bumpFeedbackFrequency(supabase, feedbackId)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        value={currentStatus}
        onChange={(e) => apply({ status: e.target.value as FeedbackStatus })}
        disabled={saving}
        className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#6D28D9] disabled:opacity-50"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
      <select
        value={currentSeverity}
        onChange={(e) => apply({ severity: e.target.value as FeedbackSeverity })}
        disabled={saving}
        className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#6D28D9] disabled:opacity-50"
      >
        {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select
        value={currentOwnerId || ''}
        onChange={(e) => e.target.value && apply({ ownerId: e.target.value })}
        disabled={saving}
        className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#6D28D9] disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name || 'Admin'}</option>)}
      </select>
      <button
        onClick={bump}
        disabled={saving}
        title="Mark that this same issue was reported again"
        className="text-xs px-2 py-1 rounded-lg border border-[#3C3A58] text-[#8A88A8] hover:text-[#EDEAF8] hover:border-[#6D28D9] disabled:opacity-50"
      >
        Reported again
      </button>
    </div>
  )
}

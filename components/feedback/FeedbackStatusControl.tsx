'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateFeedbackStatus } from '@/lib/feedback'
import { FeedbackStatus } from '@/lib/types'

const STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed']

export default function FeedbackStatusControl({ feedbackId, currentStatus }: { feedbackId: string; currentStatus: FeedbackStatus }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function change(status: FeedbackStatus) {
    if (status === currentStatus) return
    setSaving(true)
    await updateFeedbackStatus(supabase, feedbackId, status)
    setSaving(false)
    router.refresh()
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => change(e.target.value as FeedbackStatus)}
      disabled={saving}
      className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#6D28D9] disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s.replace('_', ' ')}</option>
      ))}
    </select>
  )
}

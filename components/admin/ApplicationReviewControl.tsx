'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reviewDesignPartnerApplication } from '@/lib/designPartnerApplications'

export default function ApplicationReviewControl({ applicationId }: { applicationId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState<'approved' | 'rejected' | null>(null)

  async function decide(status: 'approved' | 'rejected') {
    setSaving(status)
    await reviewDesignPartnerApplication(supabase, applicationId, status, notes.trim() || undefined)
    setSaving(null)
    router.refresh()
  }

  return (
    <div className="space-y-2 mt-2">
      <textarea
        value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Review notes (optional)"
        className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
      />
      <div className="flex gap-2">
        <button onClick={() => decide('approved')} disabled={saving !== null} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-400/30 text-green-400 hover:bg-green-500/30 disabled:opacity-50">
          {saving === 'approved' ? 'Approving...' : 'Approve'}
        </button>
        <button onClick={() => decide('rejected')} disabled={saving !== null} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-400/30 text-red-400 hover:bg-red-500/30 disabled:opacity-50">
          {saving === 'rejected' ? 'Rejecting...' : 'Reject'}
        </button>
      </div>
    </div>
  )
}

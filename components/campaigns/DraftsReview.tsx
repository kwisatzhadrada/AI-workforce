'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OutreachDraft } from '@/lib/types'

export default function DraftsReview({
  organizationId,
  agentId,
  taskId,
  drafts,
  alreadySent,
}: {
  organizationId: string
  agentId: string
  taskId: string
  drafts: OutreachDraft[]
  alreadySent: boolean
}) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function approveAndSend() {
    if (!confirm(`Send ${drafts.length} real email(s) via your connected Gmail account? This cannot be undone.`)) return
    setSending(true)
    setError(null)
    const res = await fetch('/api/campaigns/approve-and-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId, task_id: taskId, agent_id: agentId }),
    })
    const body = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok) { setError(body.error || 'Failed to send'); return }
    const sentCount = body.result?.sent?.length || 0
    const failedCount = body.result?.failed?.length || 0
    setNotice(`Sent ${sentCount} email(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}.`)
    router.refresh()
  }

  if (drafts.length === 0) return null

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-[#8A88A8]">
        Review each drafted email below. Nothing has been sent yet — approving sends all of them via your connected
        Gmail account.
      </p>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {drafts.map((d, i) => (
          <div key={`${d.email}-${i}`} className="bg-[#121428] border border-[#3C3A58]/40 rounded-lg p-3 text-xs">
            <div className="flex justify-between text-[#8A88A8] mb-1">
              <span>To: <span className="text-[#EDEAF8]">{d.name || d.email}</span> ({d.company || d.domain})</span>
            </div>
            <div className="text-[#EDEAF8] font-medium mb-1">{d.subject}</div>
            <div className="text-[#8A88A8] whitespace-pre-wrap">{d.body}</div>
          </div>
        ))}
      </div>
      {alreadySent ? (
        <div className="text-xs text-green-400">This outreach has already been sent.</div>
      ) : (
        <button
          onClick={approveAndSend}
          disabled={sending}
          className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {sending ? 'Sending...' : `Approve & Send ${drafts.length} Email(s)`}
        </button>
      )}
      {notice && <div className="text-xs text-green-400">{notice}</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}

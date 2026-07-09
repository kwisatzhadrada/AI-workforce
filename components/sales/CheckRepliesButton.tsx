'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckRepliesButton({ organizationId }: { organizationId: string }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function check() {
    setRunning(true)
    setMessage(null)
    const res = await fetch('/api/integrations/check-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId }),
    })
    const body = await res.json().catch(() => ({}))
    setRunning(false)
    if (!res.ok) { setMessage(body.error || 'Failed to check replies'); return }
    const failedNote = body.failed > 0 ? ` (${body.failed} could not be checked — see Integrations tab)` : ''
    setMessage(`Checked ${body.checked} sent email(s) — ${body.newReplies} new repl${body.newReplies === 1 ? 'y' : 'ies'}${failedNote}`)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={check}
        disabled={running}
        className="bg-[#121428] border border-[#3C3A58] hover:border-[#6D28D9] disabled:opacity-50 text-[#EDEAF8] px-3 py-1.5 rounded-lg text-sm font-medium"
      >
        {running ? 'Checking...' : '↩ Check Replies'}
      </button>
      {message && <span className="text-xs text-[#8A88A8]">{message}</span>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { grantAgentVerification } from '@/lib/registry'

export default function ApproveVerificationButton({ verificationId }: { verificationId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function approve() {
    setSaving(true)
    setError(null)
    const { error } = await grantAgentVerification(supabase, verificationId)
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        onClick={approve}
        disabled={saving}
        className="bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 text-green-400 px-3 py-1.5 rounded-lg text-sm font-medium"
      >
        {saving ? 'Approving...' : 'Approve'}
      </button>
    </div>
  )
}

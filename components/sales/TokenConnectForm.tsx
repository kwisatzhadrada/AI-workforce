'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function TokenConnectForm({
  organizationId,
  label,
  placeholder,
  helpText,
  helpUrl,
  onConnect,
  onConnected,
}: {
  organizationId: string
  label: string
  placeholder: string
  helpText: string
  helpUrl: string
  onConnect: (supabase: ReturnType<typeof createClient>, organizationId: string, token: string) => Promise<{ error: string | null }>
  onConnected?: () => void
}) {
  const supabase = createClient()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    if (!token.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await onConnect(supabase, organizationId, token.trim())
    setSaving(false)
    if (error) { setError(error); return }
    setToken('')
    router.refresh()
    onConnected?.()
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-[220px] bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
        />
        <button
          onClick={connect}
          disabled={saving || !token.trim()}
          className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {saving ? 'Connecting...' : `Connect ${label}`}
        </button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <p className="text-xs text-[#8A88A8]">
        {helpText} <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-[#8B5CF6] hover:underline">Get one here →</a>
      </p>
    </div>
  )
}

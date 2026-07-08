'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { disconnectIntegration } from '@/lib/sales'
import { IntegrationProvider } from '@/lib/types'

export default function DisconnectButton({ organizationId, provider }: { organizationId: string; provider: IntegrationProvider }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function disconnect() {
    setSaving(true)
    await disconnectIntegration(supabase, organizationId, provider)
    setSaving(false)
    router.refresh()
  }

  return (
    <button onClick={disconnect} disabled={saving} className="text-xs text-[#8A88A8] hover:text-red-400 disabled:opacity-50">
      {saving ? 'Disconnecting...' : 'Disconnect'}
    </button>
  )
}

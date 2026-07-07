'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { requestAgentVerification } from '@/lib/registry'
import { AgentVerification, VERIFICATION_LEVEL_LABELS, VERIFICATION_TYPE_LEVEL, VerificationType } from '@/lib/types'
import { getVerificationBadgeColor, formatTimeAgo } from '@/lib/utils'

const NEXT_STEP: Record<number, { type: VerificationType; label: string } | null> = {
  0: { type: 'identity', label: 'Request Identity Verification' },
  1: { type: 'skill', label: 'Request Skill Verification' },
  2: { type: 'performance', label: 'Request Performance Verification' },
  3: { type: 'trusted_workforce', label: 'Request Trusted Workforce status' },
  4: null,
}

export default function VerificationPanel({
  agentId,
  currentLevel,
  verifications,
}: {
  agentId: string
  currentLevel: number
  verifications: AgentVerification[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = NEXT_STEP[currentLevel] ?? null
  const hasPendingForNext = next && verifications.some((v) => v.verification_type === next.type && v.status === 'pending')

  async function request() {
    if (!next) return
    setSaving(true)
    setError(null)
    const level = VERIFICATION_TYPE_LEVEL[next.type]
    const { error } = await requestAgentVerification(supabase, agentId, next.type, level)
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Verification</h2>
      <div className="mb-4">
        <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm border ${getVerificationBadgeColor(currentLevel)}`}>
          Current: {VERIFICATION_LEVEL_LABELS[currentLevel as 0 | 1 | 2 | 3 | 4]}
        </span>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

      {next && (
        <button
          onClick={request}
          disabled={saving || !!hasPendingForNext}
          className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold mb-4"
        >
          {hasPendingForNext ? 'Request pending review' : saving ? 'Submitting...' : next.label}
        </button>
      )}

      {verifications.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#8A88A8] uppercase tracking-wide">History</div>
          {verifications.map((v) => (
            <div key={v.id} className="flex items-center justify-between bg-[#121428] rounded-lg px-3 py-2 text-sm">
              <span className="text-[#EDEAF8]">{v.verification_type.replace('_', ' ')} (L{v.level})</span>
              <span className="text-xs text-[#8A88A8]">{v.status} · {formatTimeAgo(v.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

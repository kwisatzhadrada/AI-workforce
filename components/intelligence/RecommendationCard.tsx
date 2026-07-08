'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { approveRecommendation, applyRecommendation, rejectRecommendation } from '@/lib/intelligence'
import { WorkforceRecommendation } from '@/lib/types'
import { formatConfidence, formatTimeAgo, getRecommendationStatusColor } from '@/lib/utils'

export default function RecommendationCard({ recommendation }: { recommendation: WorkforceRecommendation }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<{ error: string | null }>) {
    setSaving(true)
    setError(null)
    const { error } = await action()
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="font-medium text-sm text-[#EDEAF8]">{recommendation.title}</span>
        <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${getRecommendationStatusColor(recommendation.status)}`}>{recommendation.status}</span>
      </div>
      <p className="text-xs text-[#8A88A8] mb-1">{recommendation.reason}</p>
      <p className="text-xs text-[#C4B5FD] mb-2">Expected impact: {recommendation.expected_impact}</p>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-[#8A88A8]">
          Confidence {formatConfidence(recommendation.confidence_score)} · {formatTimeAgo(recommendation.created_at)}
        </span>
        {error && <span className="text-xs text-red-400">{error}</span>}
        <div className="flex items-center gap-2">
          {recommendation.status === 'pending' && (
            <>
              <button
                onClick={() => run(() => approveRecommendation(supabase, recommendation.id))}
                disabled={saving}
                className="bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 text-green-400 px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                Approve
              </button>
              <button
                onClick={() => run(() => rejectRecommendation(supabase, recommendation.id))}
                disabled={saving}
                className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                Reject
              </button>
            </>
          )}
          {recommendation.status === 'approved' && (
            <button
              onClick={() => run(() => applyRecommendation(supabase, recommendation.id))}
              disabled={saving}
              className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              Apply
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

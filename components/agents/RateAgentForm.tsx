'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { rateAgent } from '@/lib/agents'

export default function RateAgentForm({
  agentId,
  currentUserId,
  initialScore,
  initialComment,
}: {
  agentId: string
  currentUserId: string
  initialScore: number | null
  initialComment: string | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [score, setScore] = useState(initialScore ?? 5)
  const [comment, setComment] = useState(initialComment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    const { error } = await rateAgent(supabase, agentId, currentUserId, score, comment)
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#121428] rounded-xl p-4">
      <div className="text-xs font-semibold text-[#8A88A8] uppercase tracking-wide mb-2">
        {initialScore ? 'Update your rating' : 'Rate this agent'}
      </div>
      {error && <div className="text-red-400 text-xs mb-2">{error}</div>}
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className={`text-xl leading-none ${n <= score ? 'text-yellow-400' : 'text-[#3C3A58]'}`}
            aria-label={`${n} star`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="w-full bg-[#0C0D22] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm resize-none mb-3"
        rows={2}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional feedback"
      />
      <button
        onClick={submit}
        disabled={saving}
        className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        {saving ? 'Saving...' : initialScore ? 'Update Rating' : 'Submit Rating'}
      </button>
    </div>
  )
}

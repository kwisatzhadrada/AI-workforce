'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitTaskReview } from '@/lib/tasks'

export default function TaskReviewForm({ taskId, reviewerId }: { taskId: string; reviewerId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [rating, setRating] = useState(5)
  const [feedback, setFeedback] = useState('')
  const [qualityScore, setQualityScore] = useState(90)
  const [speedScore, setSpeedScore] = useState(90)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await submitTaskReview(supabase, {
      taskId, reviewerId, rating, feedback, qualityScore, speedScore,
    })
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Review this task</h2>
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#8A88A8] mb-2">Overall rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className={`text-xl leading-none ${n <= rating ? 'text-yellow-400' : 'text-[#3C3A58]'}`}>
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#8A88A8] mb-1.5">Quality score ({qualityScore})</label>
            <input type="range" min={0} max={100} value={qualityScore} onChange={(e) => setQualityScore(Number(e.target.value))} className="w-full accent-[#6D28D9]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A88A8] mb-1.5">Speed score ({speedScore})</label>
            <input type="range" min={0} max={100} value={speedScore} onChange={(e) => setSpeedScore(Number(e.target.value))} className="w-full accent-[#6D28D9]" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8A88A8] mb-1.5">Feedback</label>
          <textarea
            className="w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm resize-none"
            rows={2}
            maxLength={1000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional notes for the record"
          />
        </div>
        <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          {saving ? 'Submitting...' : 'Submit Review & Complete'}
        </button>
      </form>
    </div>
  )
}

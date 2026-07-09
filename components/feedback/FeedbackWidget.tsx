'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitFeedback } from '@/lib/feedback'
import { FeedbackType } from '@/lib/types'

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: '🐛 Bug' },
  { value: 'feature_request', label: '💡 Feature request' },
  { value: 'general', label: '💬 General feedback' },
]

export default function FeedbackWidget({ userId }: { userId: string }) {
  const supabase = createClient()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!message.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await submitFeedback(supabase, { userId, feedbackType: type, message, pageUrl: pathname })
    setSaving(false)
    if (error) { setError(error); return }
    setSent(true)
    setMessage('')
  }

  function close() {
    setOpen(false)
    setSent(false)
    setError(null)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-[#6D28D9] hover:bg-[#5B21B6] text-white px-4 py-2.5 rounded-full text-sm font-medium shadow-lg"
      >
        💬 Feedback
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-80 bg-[#0C0D22] border border-[#3C3A58] rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[#EDEAF8]">Send Feedback</h3>
        <button onClick={close} className="text-[#8A88A8] hover:text-[#EDEAF8] text-sm">✕</button>
      </div>

      {sent ? (
        <div className="text-sm text-green-400 py-2">
          Thanks — your feedback was sent.
          <button onClick={close} className="block mt-2 text-xs text-[#8A88A8] hover:text-[#EDEAF8] underline">Close</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${type === t.value ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={type === 'bug' ? "What happened? What did you expect instead?" : type === 'feature_request' ? "What would help you?" : "Anything on your mind?"}
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
          />
          <button
            onClick={submit}
            disabled={saving || !message.trim()}
            className="w-full bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {saving ? 'Sending...' : 'Send'}
          </button>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      )}
    </div>
  )
}

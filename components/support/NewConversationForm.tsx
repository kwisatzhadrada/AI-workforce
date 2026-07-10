'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createSupportConversation } from '@/lib/supportConversations'
import { ConversationCategory } from '@/lib/types'

const CATEGORIES: { value: ConversationCategory; label: string }[] = [
  { value: 'question', label: 'Ask a question' },
  { value: 'bug', label: 'Report a bug' },
  { value: 'feature_request', label: 'Request a feature' },
]

export default function NewConversationForm({ organizationId }: { organizationId?: string | null }) {
  const supabase = createClient()
  const router = useRouter()
  const [category, setCategory] = useState<ConversationCategory>('question')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!subject.trim() || !body.trim()) return
    setSaving(true)
    setError(null)
    const { conversation, error } = await createSupportConversation(supabase, { organizationId, subject: subject.trim(), category, body: body.trim() })
    setSaving(false)
    if (error) { setError(error); return }
    if (conversation) router.push(`/support/${conversation.id}`)
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-3">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg">Start a Conversation</h2>
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCategory(c.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border ${category === c.value ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
        className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Tell us more..."
        className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
      <button onClick={submit} disabled={saving || !subject.trim() || !body.trim()}
        className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
        {saving ? 'Starting...' : 'Start Conversation'}
      </button>
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}

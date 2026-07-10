'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postSupportMessage, updateSupportConversation } from '@/lib/supportConversations'
import { ConversationPriority, ConversationStatus, SupportConversation, SupportMessage } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const STATUS_COLOR: Record<ConversationStatus, string> = {
  open: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  in_progress: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  resolved: 'text-green-400 bg-green-400/10 border-green-400/20',
  closed: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
}

export default function ConversationThread({
  conversation, messages, currentUserId, isAdmin,
}: {
  conversation: SupportConversation
  messages: SupportMessage[]
  currentUserId: string
  isAdmin: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!body.trim()) return
    setSending(true)
    setError(null)
    const { error } = await postSupportMessage(supabase, conversation.id, body.trim())
    setSending(false)
    if (error) { setError(error); return }
    setBody('')
    router.refresh()
  }

  async function setStatus(status: ConversationStatus) {
    await updateSupportConversation(supabase, conversation.id, { status })
    router.refresh()
  }

  async function setPriority(priority: ConversationPriority) {
    await updateSupportConversation(supabase, conversation.id, { priority })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-['Space_Grotesk'] text-xl font-bold">{conversation.subject}</h1>
          <p className="text-xs text-[#8A88A8] capitalize">{conversation.category.replace('_', ' ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${STATUS_COLOR[conversation.status]}`}>{conversation.status.replace('_', ' ')}</span>
          {isAdmin && (
            <>
              <select value={conversation.status} onChange={(e) => setStatus(e.target.value as ConversationStatus)}
                className="text-xs bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-md px-2 py-1">
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select value={conversation.priority} onChange={(e) => setPriority(e.target.value as ConversationPriority)}
                className="text-xs bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-md px-2 py-1">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </>
          )}
        </div>
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.sender_role === 'admin' ? 'bg-[#6D28D9]/20 border border-[#6D28D9]/30' : 'bg-[#121428] border border-[#3C3A58]/30'}`}>
              <div className="text-[10px] text-[#8A88A8] mb-1">{m.sender_role === 'admin' ? 'Support' : 'You'} · {formatTimeAgo(m.created_at)}</div>
              <div className="text-sm text-[#EDEAF8] whitespace-pre-wrap">{m.body}</div>
            </div>
          </div>
        ))}
      </div>

      {conversation.status !== 'closed' && (
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            placeholder="Type a reply..."
            className="flex-1 bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
          />
          <button onClick={send} disabled={sending || !body.trim()}
            className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}

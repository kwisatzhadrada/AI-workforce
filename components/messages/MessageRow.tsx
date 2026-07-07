'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { markMessageRead } from '@/lib/agentRuntime'
import { AgentMessage } from '@/lib/types'
import { formatTimeAgo, getInitials } from '@/lib/utils'

export default function MessageRow({ message }: { message: AgentMessage }) {
  const supabase = createClient()
  const router = useRouter()
  const unread = !message.read_at

  async function markRead() {
    if (!unread) return
    await markMessageRead(supabase, message.id)
    router.refresh()
  }

  return (
    <div onClick={markRead} className={`bg-[#0C0D22] border rounded-xl p-4 cursor-pointer ${unread ? 'border-[#6D28D9]/40' : 'border-[#3C3A58]/30'}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#6D28D9] flex items-center justify-center text-xs font-semibold text-white shrink-0">
          {getInitials(message.agents?.name || null)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/agent/${message.sender_agent_id}`} className="text-sm font-medium text-[#EDEAF8] hover:underline" onClick={(e) => e.stopPropagation()}>
              {message.agents?.name || 'Agent'}
            </Link>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">{message.message_type}</span>
            {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />}
          </div>
          <p className="text-sm text-[#EDEAF8] mt-1">{message.content}</p>
          <div className="text-xs text-[#8A88A8] mt-1">{formatTimeAgo(message.created_at)}</div>
        </div>
      </div>
    </div>
  )
}

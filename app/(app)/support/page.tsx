import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyConversations } from '@/lib/supportConversations'
import NewConversationForm from '@/components/support/NewConversationForm'
import { formatTimeAgo } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  open: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  in_progress: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  resolved: 'text-green-400 bg-green-400/10 border-green-400/20',
  closed: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
}

export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const conversations = await getMyConversations(supabase, user.id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Support</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Ask a question, report a bug, or request a feature — a real person reads every message.</p>
      </div>

      <NewConversationForm />

      {conversations.length > 0 && (
        <div>
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Your Conversations</h2>
          <div className="space-y-2">
            {conversations.map((c) => (
              <Link key={c.id} href={`/support/${c.id}`} className="block bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4 hover:border-[#6D28D9]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm text-[#EDEAF8]">{c.subject}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${STATUS_COLOR[c.status]}`}>{c.status.replace('_', ' ')}</span>
                    <span className="text-xs text-[#8A88A8]">{formatTimeAgo(c.updated_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

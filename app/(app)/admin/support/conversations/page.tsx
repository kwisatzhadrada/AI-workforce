import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllConversations } from '@/lib/supportConversations'
import { formatTimeAgo } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  open: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  in_progress: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  resolved: 'text-green-400 bg-green-400/10 border-green-400/20',
  closed: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  medium: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  high: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  urgent: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export default async function AdminConversationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const conversations = await getAllConversations(supabase)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Support Conversations</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Every question, bug report, and feature request users have sent — reply from a conversation's own page.</p>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
          No conversations yet.
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <Link key={c.id} href={`/support/${c.id}`} className="block bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4 hover:border-[#6D28D9]">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <span className="text-sm text-[#EDEAF8] font-medium">{c.subject}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${PRIORITY_COLOR[c.priority]}`}>{c.priority}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${STATUS_COLOR[c.status]}`}>{c.status.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="text-xs text-[#8A88A8]">
                {c.profiles?.full_name || 'Unknown user'} {c.organizations?.name && `· ${c.organizations.name}`} · {formatTimeAgo(c.updated_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Agent } from '@/lib/types'
import { getAgentStatusColor, getInitials, formatTimeAgo } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: agents } = await supabase
    .from('agents')
    .select('*, profiles!agents_owner_id_fkey(*)')
    .order('reputation_score', { ascending: false })
    .limit(50)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Agents</h1>
          <p className="text-[#8A88A8] text-sm mt-1">AI workers, identified, rated, and ready to work.</p>
        </div>
        <Link href="/agents/new" className="bg-[#6D28D9] hover:bg-[#8B5CF6] text-white px-4 py-2 rounded-xl font-medium text-sm">
          + New Agent
        </Link>
      </div>

      <div className="space-y-4">
        {(agents as Agent[] || []).length === 0 ? (
          <div className="text-center text-[#8A88A8] py-16">No agents yet. Register the first AI worker.</div>
        ) : (
          (agents as Agent[]).map((agent) => (
            <Link key={agent.id} href={`/agent/${agent.id}`} className="block bg-[#0C0D22] border border-[#3C3A58]/30 hover:border-[#6D28D9]/40 rounded-2xl p-5 transition-colors">
              <div className="flex items-start gap-3">
                {agent.avatar_url ? (
                  <Image src={agent.avatar_url} alt="" width={40} height={40} className="rounded-full object-cover w-10 h-10 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#6D28D9] flex items-center justify-center font-semibold text-white shrink-0">
                    {getInitials(agent.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="font-['Space_Grotesk'] font-bold text-lg text-[#EDEAF8]">{agent.name}</h2>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getAgentStatusColor(agent.status)}`}>
                      {agent.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#8A88A8] mb-2">
                    Owned by {agent.profiles?.full_name || 'Unknown'} · {formatTimeAgo(agent.created_at)}
                  </div>
                  {agent.description && (
                    <p className="text-[#8A88A8] text-sm line-clamp-2 mb-3">{agent.description}</p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-[#8B5CF6] font-medium">
                      ⭐ {agent.reputation_score.toFixed(2)} ({agent.rating_count})
                    </span>
                    {agent.skills.slice(0, 4).map((skill) => (
                      <span key={skill} className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

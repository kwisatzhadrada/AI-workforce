import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgentSearchResult } from '@/lib/types'
import AgentCard from '@/components/agents/AgentCard'

type AgentRankingRow = Omit<AgentSearchResult, 'total_count'>

export const dynamic = 'force-dynamic'

const BOARDS = [
  { value: 'reputation', label: 'Top Reputation', column: 'reputation_score' },
  { value: 'trust', label: 'Top Trust Score', column: 'trust_score' },
  { value: 'performance', label: 'Top Performance', column: 'performance_score' },
  { value: 'verified', label: 'Top Verified', column: 'verification_level' },
  { value: 'trending', label: 'Trending Agents', column: 'trending_score' },
] as const

type BoardValue = (typeof BOARDS)[number]['value']

export default async function TopAgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const boardParam = params.board
  const board = (Array.isArray(boardParam) ? boardParam[0] : boardParam) as BoardValue | undefined
  const active = BOARDS.find((b) => b.value === board) || BOARDS[0]

  // Rankings only make sense among agents that are actually active in the network.
  const { data: agents } = await supabase
    .from('agents')
    .select('id, owner_id, name, description, avatar_url, skills, status, reputation_score, rating_count, trust_score, performance_score, trending_score, verification_level, followers_count, created_at')
    .eq('status', 'active')
    .order(active.column, { ascending: false })
    .limit(25)

  const rows = (agents || []) as AgentRankingRow[]

  const ownerIds = Array.from(new Set(rows.map((a) => a.owner_id)))
  const { data: owners } = ownerIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', ownerIds)
    : { data: [] }
  const ownerNameById = new Map((owners || []).map((o) => [o.id, o.full_name || 'Unknown']))

  return (
    <div>
      <div className="mb-6">
        <Link href="/agents" className="text-sm text-[#8A88A8] hover:text-[#EDEAF8]">← All agents</Link>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold mt-2">Agent Rankings</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Leaderboards across the network.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {BOARDS.map((b) => (
          <Link
            key={b.value}
            href={`/agents/top?board=${b.value}`}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              active.value === b.value
                ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="text-center text-[#8A88A8] py-16">No ranked agents yet.</div>
        ) : (
          rows.map((agent, i) => (
            <div key={agent.id} className="flex items-center gap-3">
              <span className="w-6 text-center text-sm font-semibold text-[#8A88A8] shrink-0">{i + 1}</span>
              <div className="flex-1">
                <AgentCard agent={agent} ownerName={ownerNameById.get(agent.owner_id)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

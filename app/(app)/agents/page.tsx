import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { searchAgents } from '@/lib/registry'
import { AgentCategory, AgentSortOption } from '@/lib/types'
import DirectoryControls from '@/components/agents/DirectoryControls'
import AgentCard from '@/components/agents/AgentCard'
import Pagination from '@/components/agents/Pagination'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : v
  }

  const page = Math.max(1, Number(get('page')) || 1)

  const [{ data: categories }, { agents, total, error }] = await Promise.all([
    supabase.from('agent_categories').select('*').order('name'),
    searchAgents(supabase, {
      query: get('q'),
      categorySlug: get('category'),
      status: get('status'),
      minReputation: get('min_rep') ? Number(get('min_rep')) : undefined,
      minVerificationLevel: get('min_ver') ? Number(get('min_ver')) : undefined,
      minPerformance: get('min_perf') ? Number(get('min_perf')) : undefined,
      sort: (get('sort') as AgentSortOption) || 'top_rated',
      page,
      pageSize: PAGE_SIZE,
    }),
  ])

  const ownerIds = Array.from(new Set(agents.map((a) => a.owner_id)))
  const { data: owners } = ownerIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', ownerIds)
    : { data: [] }
  const ownerNameById = new Map((owners || []).map((o) => [o.id, o.full_name || 'Unknown']))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Agents</h1>
          <p className="text-[#8A88A8] text-sm mt-1">The discoverable network of AI workers.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/agents/top" className="text-sm text-[#8A88A8] hover:text-[#EDEAF8] border border-[#3C3A58] px-4 py-2 rounded-xl">
            Rankings
          </Link>
          <Link href="/agents/new" className="bg-[#6D28D9] hover:bg-[#8B5CF6] text-white px-4 py-2 rounded-xl font-medium text-sm">
            + New Agent
          </Link>
        </div>
      </div>

      <DirectoryControls categories={(categories as AgentCategory[]) || []} />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">{error}</div>
      )}

      <div className="space-y-4">
        {agents.length === 0 ? (
          <div className="text-center text-[#8A88A8] py-16">No agents match your search.</div>
        ) : (
          agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} ownerName={ownerNameById.get(agent.owner_id)} />
          ))
        )}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  )
}

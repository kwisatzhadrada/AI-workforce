import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AgentExecution } from '@/lib/types'
import { formatDuration, getTrustScoreColor } from '@/lib/utils'
import ExecutionRow from '@/components/tasks/ExecutionRow'
import ExecutionViewControls from '@/components/tasks/ExecutionViewControls'

export const dynamic = 'force-dynamic'

const EXECUTION_SELECT = '*, agents(id, name, avatar_url, owner_id), tasks(id, title), agent_capabilities(id, name)'
const PAGE_SIZE = 20

export default async function ExecutionsPage({
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

  const view = get('view') || 'mine'
  const orgId = get('org_id') || ''
  const page = Math.max(1, Number(get('page')) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const [{ data: myOrgMemberships }, { data: myAgents }] = await Promise.all([
    supabase.from('organization_members').select('organizations(id, name)').eq('user_id', user.id),
    supabase.from('agents').select('id').eq('owner_id', user.id),
  ])

  const myOrgs = Array.from(
    new Map(((myOrgMemberships || []) as unknown as { organizations: { id: string; name: string } | null }[])
      .filter((m) => m.organizations)
      .map((m) => [m.organizations!.id, m.organizations!])
    ).values()
  )

  let agentIds: string[] = (myAgents || []).map((a) => a.id)
  let ready = true
  let totalAgentsInScope = agentIds.length

  if (view === 'organization') {
    if (!orgId) {
      ready = false
      agentIds = []
    } else {
      const { data: assigned } = await supabase.from('agent_assignments').select('agent_id').eq('organization_id', orgId).eq('status', 'active')
      agentIds = Array.from(new Set((assigned || []).map((a) => a.agent_id)))
      totalAgentsInScope = agentIds.length
    }
  }

  let executions: AgentExecution[] = []
  let total = 0
  let metricsRows: { status: string; execution_time_ms: number | null; agent_id: string }[] = []

  if (ready && agentIds.length > 0) {
    const [{ data, count }, { data: recentForMetrics }] = await Promise.all([
      supabase
        .from('agent_executions')
        .select(EXECUTION_SELECT, { count: 'exact' })
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false })
        .range(from, to),
      supabase
        .from('agent_executions')
        .select('status, execution_time_ms, agent_id')
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false })
        .limit(2000),
    ])
    executions = (data as AgentExecution[]) || []
    total = count || 0
    metricsRows = recentForMetrics || []
  } else if (ready) {
    ready = agentIds.length > 0 || view === 'mine'
  }

  const active = metricsRows.filter((r) => r.status === 'queued' || r.status === 'running').length
  const failed = metricsRows.filter((r) => r.status === 'failed').length
  const completed = metricsRows.filter((r) => r.status === 'completed').length
  const successRate = completed + failed > 0 ? (completed / (completed + failed)) * 100 : 0
  const durations = metricsRows.filter((r) => r.status === 'completed' && r.execution_time_ms != null).map((r) => r.execution_time_ms as number)
  const avgRuntimeMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null
  const busyAgents = new Set(metricsRows.filter((r) => r.status === 'running').map((r) => r.agent_id)).size
  const utilization = totalAgentsInScope > 0 ? (busyAgents / totalAgentsInScope) * 100 : 0

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Executions</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Runtime activity across your agents.</p>
      </div>

      <ExecutionViewControls myOrgs={myOrgs} />

      {!ready ? (
        <div className="text-center text-[#8A88A8] py-16">Choose an organization to see its executions.</div>
      ) : agentIds.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-16">No agents in scope yet.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Active</div>
              <div className="text-2xl font-bold text-cyan-400">{active}</div>
            </div>
            <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Failed</div>
              <div className="text-2xl font-bold text-red-400">{failed}</div>
            </div>
            <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Success Rate</div>
              <div className={`text-2xl font-bold ${getTrustScoreColor(successRate)}`}>{successRate.toFixed(0)}%</div>
            </div>
            <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Avg Runtime</div>
              <div className="text-2xl font-bold text-[#EDEAF8]">{avgRuntimeMs != null ? formatDuration(Math.round(avgRuntimeMs / 1000)) : '—'}</div>
            </div>
            <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Utilization</div>
              <div className="text-2xl font-bold text-[#EDEAF8]">{utilization.toFixed(0)}%</div>
            </div>
          </div>

          {executions.length === 0 ? (
            <div className="text-center text-[#8A88A8] py-16">No executions yet.</div>
          ) : (
            <div className="space-y-2">
              {executions.map((e) => <ExecutionRow key={e.id} execution={e} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="text-center text-sm text-[#8A88A8] mt-6">Page {page} of {totalPages} · {total.toLocaleString()} executions</div>
          )}
        </>
      )}
    </div>
  )
}

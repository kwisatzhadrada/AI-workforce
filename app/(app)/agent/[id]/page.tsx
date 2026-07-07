import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgentCredential, AgentRating, AgentTransaction, AgentWallet, AgentPerformanceMetrics } from '@/lib/types'
import { getAgentStatusColor, getInitials, formatTimeAgo } from '@/lib/utils'
import RateAgentForm from '@/components/agents/RateAgentForm'
import WalletPanel from '@/components/agents/WalletPanel'

export const dynamic = 'force-dynamic'

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: agent } = await supabase
    .from('agents')
    .select('*, profiles!agents_owner_id_fkey(*), agent_performance_metrics(*)')
    .eq('id', id)
    .maybeSingle()

  if (!agent) notFound()

  const isOwner = agent.owner_id === user.id

  const [{ data: credentials }, { data: ratings }, { data: myRating }, { data: wallet }, { data: transactions }] = await Promise.all([
    supabase.from('agent_credentials').select('*').eq('agent_id', id).order('created_at', { ascending: false }),
    supabase.from('agent_ratings').select('*, profiles(*)').eq('agent_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('agent_ratings').select('*').eq('agent_id', id).eq('rater_id', user.id).maybeSingle(),
    isOwner
      ? supabase.from('agent_wallets').select('*').eq('agent_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
    isOwner
      ? supabase.from('agent_transactions').select('*').eq('agent_id', id).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: null }),
  ])

  const perf = agent.agent_performance_metrics as AgentPerformanceMetrics | AgentPerformanceMetrics[] | null
  const performance = Array.isArray(perf) ? perf[0] : perf

  return (
    <div className="max-w-2xl mx-auto">
      {/* Identity header */}
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {agent.avatar_url ? (
              <Image src={agent.avatar_url} alt="" width={48} height={48} className="rounded-full object-cover w-12 h-12" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#6D28D9] flex items-center justify-center font-semibold text-white text-lg">
                {getInitials(agent.name)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-['Space_Grotesk'] text-xl font-bold text-[#EDEAF8]">{agent.name}</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getAgentStatusColor(agent.status)}`}>
                  {agent.status}
                </span>
              </div>
              <div className="text-xs text-[#8A88A8] mt-0.5">
                Agent ID: <span className="font-mono">{agent.id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-[#8A88A8] mb-4">
          Owner: <span className="text-[#EDEAF8]">{agent.profiles?.full_name || 'Unknown'}</span>
          {' '}· registered {formatTimeAgo(agent.created_at)}
        </div>

        {agent.description && <p className="text-[#EDEAF8] mb-4 leading-relaxed">{agent.description}</p>}

        <div className="mb-4">
          <div className="text-xs font-semibold text-[#8A88A8] uppercase tracking-wide mb-2">Skills</div>
          <div className="flex flex-wrap gap-2">
            {agent.skills.length === 0 ? (
              <span className="text-sm text-[#8A88A8]">No skills listed.</span>
            ) : (
              agent.skills.map((skill: string) => (
                <span key={skill} className="text-xs px-2 py-1 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                  {skill}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-yellow-400">⭐ {agent.reputation_score.toFixed(2)}</span>
          <span className="text-sm text-[#8A88A8]">({agent.rating_count} rating{agent.rating_count === 1 ? '' : 's'})</span>
        </div>
      </div>

      {/* Performance Metrics */}
      {performance && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#121428] rounded-xl p-3">
              <div className="text-xs text-[#8A88A8] mb-1">Tasks Completed</div>
              <div className="text-lg font-semibold text-[#EDEAF8]">{performance.tasks_completed}</div>
            </div>
            <div className="bg-[#121428] rounded-xl p-3">
              <div className="text-xs text-[#8A88A8] mb-1">Tasks Failed</div>
              <div className="text-lg font-semibold text-[#EDEAF8]">{performance.tasks_failed}</div>
            </div>
            <div className="bg-[#121428] rounded-xl p-3">
              <div className="text-xs text-[#8A88A8] mb-1">Success Rate</div>
              <div className="text-lg font-semibold text-[#EDEAF8]">{performance.success_rate}%</div>
            </div>
            <div className="bg-[#121428] rounded-xl p-3">
              <div className="text-xs text-[#8A88A8] mb-1">Avg Response Time</div>
              <div className="text-lg font-semibold text-[#EDEAF8]">
                {performance.avg_response_time_ms != null ? `${performance.avg_response_time_ms}ms` : '—'}
              </div>
            </div>
          </div>
          {performance.last_active_at && (
            <div className="text-xs text-[#8A88A8] mt-3">Last active {formatTimeAgo(performance.last_active_at)}</div>
          )}
        </div>
      )}

      {/* Credentials */}
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Credentials</h2>
        {(credentials || []).length === 0 ? (
          <div className="text-sm text-[#8A88A8]">No credentials on file.</div>
        ) : (
          <div className="space-y-3">
            {(credentials as AgentCredential[]).map((c) => (
              <div key={c.id} className="flex items-start justify-between bg-[#121428] rounded-xl p-3">
                <div>
                  <div className="font-medium text-sm text-[#EDEAF8]">{c.title}</div>
                  {c.issuer && <div className="text-xs text-[#8A88A8]">Issued by {c.issuer}</div>}
                </div>
                {c.verified && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 shrink-0">
                    ✓ Verified
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wallet — owner only */}
      {isOwner && wallet && (
        <WalletPanel agentId={agent.id} wallet={wallet as AgentWallet} transactions={(transactions as AgentTransaction[]) || []} />
      )}

      {/* Reputation / Ratings */}
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Reputation</h2>

        {!isOwner && (
          <div className="mb-4">
            <RateAgentForm
              agentId={agent.id}
              currentUserId={user.id}
              initialScore={(myRating as AgentRating | null)?.score ?? null}
              initialComment={(myRating as AgentRating | null)?.comment ?? null}
            />
          </div>
        )}

        {(ratings || []).length === 0 ? (
          <div className="text-sm text-[#8A88A8]">No ratings yet.</div>
        ) : (
          <div className="space-y-3">
            {(ratings as AgentRating[]).map((r) => (
              <div key={r.id} className="flex items-start gap-3 bg-[#121428] rounded-xl p-3">
                {r.profiles?.avatar_url ? (
                  <Image src={r.profiles.avatar_url} alt="" width={28} height={28} className="rounded-full object-cover w-7 h-7 shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#6D28D9] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                    {getInitials(r.profiles?.full_name || null)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#EDEAF8]">{r.profiles?.full_name || 'Someone'}</span>
                    <span className="text-yellow-400 text-xs">{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</span>
                  </div>
                  {r.comment && <p className="text-sm text-[#8A88A8] mt-1">{r.comment}</p>}
                  <div className="text-xs text-[#8A88A8] mt-1">{formatTimeAgo(r.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwner && (
        <div className="text-center">
          <Link href={`/agent/${agent.id}/edit`} className="text-sm text-[#8A88A8] hover:text-[#EDEAF8]">
            Manage credentials & status →
          </Link>
        </div>
      )}
    </div>
  )
}

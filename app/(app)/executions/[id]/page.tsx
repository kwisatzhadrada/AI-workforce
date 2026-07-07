import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgentDecision, AgentErrorLog } from '@/lib/types'
import { formatDuration, formatTimeAgo, getExecutionStatusColor, getDecisionOutcomeColor } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: execution } = await supabase
    .from('agent_executions')
    .select('*, agents(id, name, avatar_url, owner_id), tasks(id, title), agent_capabilities(id, name)')
    .eq('id', id)
    .maybeSingle()

  if (!execution) notFound()

  const [{ data: decisions }, { data: errorLogs }] = await Promise.all([
    supabase.from('agent_decisions').select('*').eq('execution_id', id).order('created_at', { ascending: true }),
    supabase.from('agent_error_logs').select('*').eq('execution_id', id).order('created_at', { ascending: true }),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/executions" className="text-sm text-[#8A88A8] hover:text-[#EDEAF8]">← All executions</Link>
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="font-['Space_Grotesk'] text-xl font-bold text-[#EDEAF8]">
              {execution.agent_capabilities?.name || 'Execution'}
            </h1>
            <div className="text-xs text-[#8A88A8] mt-1">
              <Link href={`/agent/${execution.agents?.id}`} className="hover:underline">{execution.agents?.name}</Link>
              {execution.tasks && (
                <> · <Link href={`/tasks/${execution.tasks.id}`} className="hover:underline">{execution.tasks.title}</Link></>
              )}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-md border shrink-0 ${getExecutionStatusColor(execution.status)}`}>{execution.status}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-[#121428] rounded-xl p-3">
            <div className="text-xs text-[#8A88A8] mb-1">Provider</div>
            <div className="text-sm font-medium text-[#EDEAF8]">{execution.provider || '—'}</div>
          </div>
          <div className="bg-[#121428] rounded-xl p-3">
            <div className="text-xs text-[#8A88A8] mb-1">Model</div>
            <div className="text-sm font-medium text-[#EDEAF8]">{execution.model || '—'}</div>
          </div>
          <div className="bg-[#121428] rounded-xl p-3">
            <div className="text-xs text-[#8A88A8] mb-1">Duration</div>
            <div className="text-sm font-medium text-[#EDEAF8]">{execution.execution_time_ms != null ? formatDuration(Math.round(execution.execution_time_ms / 1000)) : '—'}</div>
          </div>
          <div className="bg-[#121428] rounded-xl p-3">
            <div className="text-xs text-[#8A88A8] mb-1">Tokens</div>
            <div className="text-sm font-medium text-[#EDEAF8]">{execution.tokens_used ?? '—'}</div>
          </div>
        </div>
        <div className="text-xs text-[#8A88A8] mt-3">
          created {formatTimeAgo(execution.created_at)}
          {execution.started_at && ` · started ${formatTimeAgo(execution.started_at)}`}
          {execution.completed_at && ` · completed ${formatTimeAgo(execution.completed_at)}`}
        </div>
      </div>

      {Object.keys(execution.input || {}).length > 0 && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Input</h2>
          <pre className="text-xs text-[#8A88A8] bg-[#121428] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(execution.input, null, 2)}</pre>
        </div>
      )}

      {execution.output && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Output</h2>
          {typeof execution.output.result === 'string' ? (
            <p className="text-sm text-[#EDEAF8] whitespace-pre-wrap">{execution.output.result}</p>
          ) : (
            <pre className="text-xs text-[#8A88A8] bg-[#121428] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(execution.output, null, 2)}</pre>
          )}
        </div>
      )}

      {execution.error && (
        <div className="bg-[#0C0D22] border border-red-500/20 rounded-2xl p-5 mb-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3 text-red-400">Error</h2>
          <p className="text-sm text-red-300">{execution.error}</p>
        </div>
      )}

      {(errorLogs || []).length > 0 && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Error Logs</h2>
          <div className="space-y-2">
            {(errorLogs as AgentErrorLog[]).map((e) => (
              <div key={e.id} className="bg-[#121428] rounded-lg px-3 py-2">
                <div className="text-sm text-red-300">{e.error_type}: {e.message}</div>
                <div className="text-xs text-[#8A88A8] mt-1">{formatTimeAgo(e.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Decision Log</h2>
        {(decisions || []).length === 0 ? (
          <div className="text-sm text-[#8A88A8]">No decisions logged for this execution.</div>
        ) : (
          <div className="space-y-2">
            {(decisions as AgentDecision[]).map((d) => (
              <div key={d.id} className="bg-[#121428] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#EDEAF8] font-medium">{d.decision_type.replace('_', ' ')}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${getDecisionOutcomeColor(d.outcome)}`}>{d.outcome}</span>
                </div>
                <p className="text-xs text-[#8A88A8] mt-1">{d.reasoning}</p>
                <div className="text-xs text-[#3C3A58] mt-1">{formatTimeAgo(d.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

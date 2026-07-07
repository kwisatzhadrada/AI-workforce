'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AgentCapability, AgentExecution, ModelProviderName } from '@/lib/types'
import { formatDuration, formatTimeAgo, getExecutionStatusColor } from '@/lib/utils'

const PROVIDERS: { value: ModelProviderName; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'local', label: 'Local model' },
]

export default function ExecutionPanel({
  taskId,
  agentId,
  taskTitle,
  taskDescription,
  capabilities,
  executions,
}: {
  taskId: string
  agentId: string
  taskTitle: string
  taskDescription: string | null
  capabilities: AgentCapability[]
  executions: AgentExecution[]
}) {
  const router = useRouter()
  const enabledCapabilities = capabilities.filter((c) => c.enabled)
  const [capabilityId, setCapabilityId] = useState(enabledCapabilities[0]?.id || '')
  const [provider, setProvider] = useState<ModelProviderName>('openai')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectCls = 'bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]'

  async function run() {
    setRunning(true)
    setError(null)
    const res = await fetch('/api/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        task_id: taskId,
        capability_id: capabilityId || null,
        provider,
        input: { title: taskTitle, description: taskDescription },
      }),
    })
    const body = await res.json().catch(() => ({}))
    setRunning(false)
    if (!res.ok) { setError(body.error || 'Execution failed to start'); return }
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Runtime Execution</h2>

      {enabledCapabilities.length === 0 ? (
        <div className="text-sm text-[#8A88A8] mb-4">This agent has no enabled capabilities yet — add one from the agent's manage page.</div>
      ) : (
        <div className="flex flex-wrap gap-2 items-end mb-4">
          <select className={selectCls} value={capabilityId} onChange={(e) => setCapabilityId(e.target.value)}>
            {enabledCapabilities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={selectCls} value={provider} onChange={(e) => setProvider(e.target.value as ModelProviderName)}>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button onClick={run} disabled={running} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {running ? 'Running...' : '▶ Run Execution'}
          </button>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

      {executions.length > 0 && (
        <div className="space-y-2">
          {executions.map((e) => (
            <Link key={e.id} href={`/executions/${e.id}`} className="flex items-center justify-between bg-[#121428] hover:bg-[#181A30] rounded-lg px-3 py-2 block">
              <div className="min-w-0">
                <div className="text-sm text-[#EDEAF8]">{e.agent_capabilities?.name || 'Execution'} · {e.provider}</div>
                <div className="text-xs text-[#8A88A8]">
                  {formatTimeAgo(e.created_at)}
                  {e.execution_time_ms != null && ` · ${formatDuration(Math.round(e.execution_time_ms / 1000))}`}
                  {e.tokens_used != null && ` · ${e.tokens_used} tokens`}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-md border shrink-0 ${getExecutionStatusColor(e.status)}`}>
                {e.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

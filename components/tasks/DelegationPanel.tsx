'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { proposeDelegation, respondToDelegation } from '@/lib/agentRuntime'
import { Delegation } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

export default function DelegationPanel({
  taskId,
  fromAgentId,
  delegationTargets,
  delegations,
  currentUserOwnedAgentIds,
}: {
  taskId: string
  fromAgentId: string
  delegationTargets: { id: string; name: string }[]
  delegations: Delegation[]
  currentUserOwnedAgentIds: string[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [toAgentId, setToAgentId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!toAgentId) return
    setSaving(true)
    setError(null)
    const { error } = await proposeDelegation(supabase, { taskId, fromAgentId, toAgentId, reason })
    setSaving(false)
    if (error) { setError(error); return }
    setToAgentId('')
    setReason('')
    router.refresh()
  }

  async function respond(delegationId: string, status: 'accepted' | 'rejected') {
    setBusyId(delegationId)
    await respondToDelegation(supabase, delegationId, status)
    setBusyId(null)
    router.refresh()
  }

  const otherTargets = delegationTargets.filter((t) => t.id !== fromAgentId)

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Delegation</h2>

      {delegations.length > 0 && (
        <div className="space-y-2 mb-4">
          {delegations.map((d) => {
            const canRespond = d.status === 'pending' && currentUserOwnedAgentIds.includes(d.to_agent_id)
            return (
              <div key={d.id} className="bg-[#121428] rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[#EDEAF8]">
                    {d.from_agent?.name || 'Agent'} → {d.to_agent?.name || 'Agent'}
                  </span>
                  <span className="text-xs text-[#8A88A8]">{d.status} · {formatTimeAgo(d.created_at)}</span>
                </div>
                {d.reason && <p className="text-xs text-[#8A88A8] mt-1">{d.reason}</p>}
                {canRespond && (
                  <div className="flex gap-2 mt-2">
                    <button disabled={busyId === d.id} onClick={() => respond(d.id, 'accepted')} className="text-xs text-green-400 border border-green-500/20 bg-green-500/10 px-2 py-1 rounded-lg disabled:opacity-50">
                      Accept
                    </button>
                    <button disabled={busyId === d.id} onClick={() => respond(d.id, 'rejected')} className="text-xs text-red-400 border border-red-500/20 bg-red-500/10 px-2 py-1 rounded-lg disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

      {otherTargets.length > 0 ? (
        <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
          <select
            className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
            value={toAgentId}
            onChange={(e) => setToAgentId(e.target.value)}
          >
            <option value="">Delegate to…</option>
            {otherTargets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            className="flex-1 min-w-[160px] bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={300}
          />
          <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {saving ? 'Proposing...' : 'Propose Delegation'}
          </button>
        </form>
      ) : (
        <div className="text-sm text-[#8A88A8]">No other agents available in this organization to delegate to.</div>
      )}
    </div>
  )
}

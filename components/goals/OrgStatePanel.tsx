import { OrganizationState } from '@/lib/types'
import { getRiskScoreColor } from '@/lib/utils'

export default function OrgStatePanel({ state }: { state: OrganizationState | null }) {
  if (!state) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
        <div className="text-xs text-[#8A88A8] mb-1">Active Goals</div>
        <div className="text-2xl font-bold text-[#EDEAF8]">{state.active_goals}</div>
      </div>
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
        <div className="text-xs text-[#8A88A8] mb-1">Blocked Goals</div>
        <div className="text-2xl font-bold text-yellow-400">{state.blocked_goals}</div>
      </div>
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
        <div className="text-xs text-[#8A88A8] mb-1">Resource Use</div>
        <div className="text-2xl font-bold text-[#EDEAF8]">{state.resource_utilization.toFixed(0)}%</div>
      </div>
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
        <div className="text-xs text-[#8A88A8] mb-1">Agent Utilization</div>
        <div className="text-2xl font-bold text-[#EDEAF8]">{state.agent_utilization.toFixed(0)}%</div>
      </div>
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
        <div className="text-xs text-[#8A88A8] mb-1">Risk Score</div>
        <div className={`text-2xl font-bold ${getRiskScoreColor(state.risk_score)}`}>{state.risk_score.toFixed(0)}</div>
      </div>
    </div>
  )
}

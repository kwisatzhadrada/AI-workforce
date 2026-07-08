import { AgentDecision } from '@/lib/types'
import { formatTimeAgo, getDecisionOutcomeColor } from '@/lib/utils'

export default function DecisionLogPanel({ decisions }: { decisions: AgentDecision[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Manager Agent Decisions</h2>
      <p className="text-xs text-[#8A88A8] mb-4">Every autonomous action this goal's manager agent takes is logged here.</p>
      {decisions.length === 0 ? (
        <div className="text-sm text-[#8A88A8]">No decisions logged yet.</div>
      ) : (
        <div className="space-y-2">
          {decisions.map((d) => (
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
  )
}

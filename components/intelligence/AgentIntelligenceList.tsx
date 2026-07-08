import Link from 'next/link'
import { AgentProfileIntelligence, RankedAgent } from '@/lib/types'
import { getGrowthTrendColor, getGrowthTrendIcon, getTrustScoreColor } from '@/lib/utils'

type Row = RankedAgent & { profile?: AgentProfileIntelligence }

export default function AgentIntelligenceList({ agents }: { agents: Row[] }) {
  if (agents.length === 0) {
    return <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">No agents yet.</div>
  }

  return (
    <div className="space-y-3">
      {agents.map((a) => (
        <div key={a.agent_id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8A88A8]">#{a.rank}</span>
              <Link href={`/agent/${a.agent_id}`} className="font-medium text-sm text-[#EDEAF8] hover:underline">{a.name}</Link>
              {a.profile && (
                <span className={`text-xs px-2 py-0.5 rounded-md border ${getGrowthTrendColor(a.profile.growth_trend)}`}>
                  {getGrowthTrendIcon(a.profile.growth_trend)} {a.profile.growth_trend.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-[#8A88A8]">
              <span>career <span className={getTrustScoreColor(a.career_score)}>{a.career_score.toFixed(0)}</span></span>
              <span>trust <span className={getTrustScoreColor(a.trust_score)}>{a.trust_score.toFixed(0)}</span></span>
              <span>success {a.success_rate.toFixed(0)}%</span>
            </div>
          </div>
          {a.profile && (
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {a.profile.strengths.length > 0 && (
                <div><span className="text-green-400">Strengths:</span> <span className="text-[#8A88A8]">{a.profile.strengths.join('; ')}</span></div>
              )}
              {a.profile.weaknesses.length > 0 && (
                <div><span className="text-red-400">Weaknesses:</span> <span className="text-[#8A88A8]">{a.profile.weaknesses.join('; ')}</span></div>
              )}
              {a.profile.risk_factors.length > 0 && (
                <div><span className="text-yellow-400">Risk factors:</span> <span className="text-[#8A88A8]">{a.profile.risk_factors.join(', ')}</span></div>
              )}
              {a.profile.specializations.length > 0 && (
                <div><span className="text-[#C4B5FD]">Specializations:</span> <span className="text-[#8A88A8]">{a.profile.specializations.join(', ')}</span></div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

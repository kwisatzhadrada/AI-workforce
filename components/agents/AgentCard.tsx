import Link from 'next/link'
import Image from 'next/image'
import { AgentSearchResult } from '@/lib/types'
import { getAgentStatusColor, getInitials, getTrustScoreColor, formatTimeAgo } from '@/lib/utils'
import VerificationBadge from './VerificationBadge'

type AgentCardData = Omit<AgentSearchResult, 'total_count'>

export default function AgentCard({ agent, ownerName }: { agent: AgentCardData; ownerName?: string }) {
  return (
    <Link href={`/agent/${agent.id}`} className="block bg-[#0C0D22] border border-[#3C3A58]/30 hover:border-[#6D28D9]/40 rounded-2xl p-5 transition-colors">
      <div className="flex items-start gap-3">
        {agent.avatar_url ? (
          <Image src={agent.avatar_url} alt="" width={40} height={40} className="rounded-full object-cover w-10 h-10 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#6D28D9] flex items-center justify-center font-semibold text-white shrink-0">
            {getInitials(agent.name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="font-['Space_Grotesk'] font-bold text-lg text-[#EDEAF8]">{agent.name}</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getAgentStatusColor(agent.status)}`}>
              {agent.status}
            </span>
            <VerificationBadge level={agent.verification_level} compact />
          </div>
          <div className="text-xs text-[#8A88A8] mb-2">
            {ownerName && <>Owned by {ownerName} · </>}registered {formatTimeAgo(agent.created_at)}
          </div>
          {agent.description && (
            <p className="text-[#8A88A8] text-sm line-clamp-2 mb-3">{agent.description}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="text-[#8B5CF6] font-medium">⭐ {agent.reputation_score.toFixed(2)} ({agent.rating_count})</span>
            <span className={`font-medium ${getTrustScoreColor(agent.trust_score)}`}>Trust {agent.trust_score.toFixed(0)}</span>
            <span className="text-[#8A88A8]">Performance {agent.performance_score.toFixed(0)}%</span>
            <span className="text-[#8A88A8]">{agent.followers_count} followers</span>
          </div>
          {agent.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {agent.skills.slice(0, 4).map((skill) => (
                <span key={skill} className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

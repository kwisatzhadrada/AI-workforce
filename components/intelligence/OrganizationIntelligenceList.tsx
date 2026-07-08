import Link from 'next/link'
import { OrganizationHealth, RankedOrganization } from '@/lib/types'
import { getTrustScoreColor } from '@/lib/utils'

type Row = RankedOrganization & { health?: OrganizationHealth }

export default function OrganizationIntelligenceList({ organizations }: { organizations: Row[] }) {
  if (organizations.length === 0) {
    return <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">No organizations yet.</div>
  }

  return (
    <div className="space-y-3">
      {organizations.map((o) => (
        <div key={o.organization_id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8A88A8]">#{o.rank}</span>
              <Link href={`/organizations/${o.organization_id}`} className="font-medium text-sm text-[#EDEAF8] hover:underline">{o.name}</Link>
            </div>
            <span className={`text-sm font-bold ${getTrustScoreColor(o.health_score)}`}>{o.health_score.toFixed(0)}</span>
          </div>
          {o.health && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><span className="text-[#8A88A8]">Goals</span> <div className="text-[#EDEAF8]">{o.health.goal_completion_rate.toFixed(0)}%</div></div>
              <div><span className="text-[#8A88A8]">Workflows</span> <div className="text-[#EDEAF8]">{o.health.workflow_completion_rate.toFixed(0)}%</div></div>
              <div><span className="text-[#8A88A8]">Utilization</span> <div className="text-[#EDEAF8]">{o.health.agent_utilization.toFixed(0)}%</div></div>
              <div><span className="text-[#8A88A8]">Failure rate</span> <div className="text-[#EDEAF8]">{o.health.failure_rate.toFixed(0)}%</div></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

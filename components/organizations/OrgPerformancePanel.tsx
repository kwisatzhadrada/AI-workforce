import { OrganizationMetrics } from '@/lib/types'
import { getTrustScoreColor } from '@/lib/utils'

type DepartmentBreakdownRow = { department_name: string; agent_count: number }

export default function OrgPerformancePanel({
  metrics,
  departmentBreakdown,
}: {
  metrics: OrganizationMetrics | null
  departmentBreakdown: DepartmentBreakdownRow[]
}) {
  if (!metrics) {
    return <div className="text-center text-[#8A88A8] py-16">No performance data yet.</div>
  }

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Total Agents</div>
          <div className="text-2xl font-bold text-[#EDEAF8]">{metrics.total_agents}</div>
        </div>
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Active Agents</div>
          <div className="text-2xl font-bold text-[#EDEAF8]">{metrics.active_agents}</div>
        </div>
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Tasks Completed</div>
          <div className="text-2xl font-bold text-[#EDEAF8]">{metrics.tasks_completed.toLocaleString()}</div>
        </div>
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Success Rate</div>
          <div className="text-2xl font-bold text-[#EDEAF8]">{metrics.success_rate.toFixed(1)}%</div>
        </div>
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Trust Score</div>
          <div className={`text-2xl font-bold ${getTrustScoreColor(metrics.trust_score)}`}>{metrics.trust_score.toFixed(0)}</div>
        </div>
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Reputation Score</div>
          <div className="text-2xl font-bold text-yellow-400">⭐ {metrics.reputation_score.toFixed(2)}</div>
        </div>
      </div>

      {departmentBreakdown.length > 0 && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Active Agents by Department</h2>
          <div className="space-y-2">
            {departmentBreakdown.map((row) => (
              <div key={row.department_name} className="flex items-center justify-between bg-[#121428] rounded-lg px-3 py-2">
                <span className="text-sm text-[#EDEAF8]">{row.department_name}</span>
                <span className="text-sm text-[#8B5CF6] font-medium">{row.agent_count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

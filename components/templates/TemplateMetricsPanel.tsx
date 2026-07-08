import { TemplateMetrics } from '@/lib/types'
import { getTrustScoreColor } from '@/lib/utils'

export default function TemplateMetricsPanel({ metrics }: { metrics: TemplateMetrics | null }) {
  if (!metrics) return null

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
        <div className="text-xs text-[#8A88A8] mb-1">Template Usage</div>
        <div className="text-2xl font-bold text-[#EDEAF8]">{metrics.usage_count}</div>
      </div>
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
        <div className="text-xs text-[#8A88A8] mb-1">Deployment Success</div>
        <div className={`text-2xl font-bold ${metrics.deployments_total > 0 ? getTrustScoreColor(metrics.deployment_success_rate) : 'text-[#EDEAF8]'}`}>
          {metrics.deployments_total > 0 ? `${metrics.deployment_success_rate.toFixed(0)}%` : '—'}
        </div>
      </div>
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
        <div className="text-xs text-[#8A88A8] mb-1">Goal Completion Rate</div>
        <div className={`text-2xl font-bold ${metrics.goals_total > 0 ? getTrustScoreColor(metrics.goal_completion_rate) : 'text-[#EDEAF8]'}`}>
          {metrics.goals_total > 0 ? `${metrics.goal_completion_rate.toFixed(0)}%` : '—'}
        </div>
      </div>
    </div>
  )
}

import { SystemReport } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

export default function ReportCard({ report }: { report: SystemReport }) {
  const { content } = report

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-sm font-medium text-[#EDEAF8] capitalize">{report.report_type} Report</span>
        <span className="text-xs text-[#8A88A8]">{formatTimeAgo(report.created_at)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-xs text-[#8A88A8]">Active Orgs</div>
          <div className="text-lg font-semibold text-[#EDEAF8]">{content.network_health?.active_organizations ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-[#8A88A8]">Active Agents</div>
          <div className="text-lg font-semibold text-[#EDEAF8]">{content.network_health?.active_agents ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-[#8A88A8]">Autonomy Score</div>
          <div className="text-lg font-semibold text-[#EDEAF8]">{content.autonomy_score?.overall_score?.toFixed(0) ?? '—'}</div>
        </div>
      </div>

      {content.top_organizations?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#8A88A8] mb-1">Top Organizations</div>
          <div className="space-y-1">
            {content.top_organizations.map((o) => (
              <div key={o.organization_id} className="flex justify-between text-xs">
                <span className="text-[#EDEAF8]">{o.name}</span>
                <span className="text-[#8A88A8]">{o.success_rate.toFixed(0)}% success · {o.tasks_completed} tasks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.top_agents?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#8A88A8] mb-1">Top Agents</div>
          <div className="space-y-1">
            {content.top_agents.map((a) => (
              <div key={a.agent_id} className="flex justify-between text-xs">
                <span className="text-[#EDEAF8]">{a.name}</span>
                <span className="text-[#8A88A8]">trust {a.trust_score} · {a.tasks_completed ?? 0} tasks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.optimization_opportunities?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#8A88A8] mb-1">Optimization Opportunities</div>
          <ul className="list-disc list-inside space-y-1">
            {content.optimization_opportunities.map((o, i) => (
              <li key={i} className="text-xs text-[#EDEAF8]">{o}</li>
            ))}
          </ul>
        </div>
      )}

      {content.top_performers?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#8A88A8] mb-1">Top Performers</div>
          <div className="space-y-1">
            {content.top_performers.map((a) => (
              <div key={a.agent_id} className="flex justify-between text-xs">
                <span className="text-[#EDEAF8]">{a.name}</span>
                <span className="text-[#8A88A8]">career score {a.career_score.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.biggest_risks?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#8A88A8] mb-1">Biggest Risks</div>
          <div className="space-y-1">
            {content.biggest_risks.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-[#EDEAF8] capitalize">{r.entity_type} · {r.prediction_type.replace(/_/g, ' ')}</span>
                <span className="text-red-400">{r.predicted_value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.growth_opportunities?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#8A88A8] mb-1">Growth Opportunities</div>
          <div className="space-y-1">
            {content.growth_opportunities.map((a) => (
              <div key={a.agent_id} className="text-xs text-[#EDEAF8]">📈 {a.name}{a.specializations?.length > 0 ? ` — ${a.specializations.join(', ')}` : ''}</div>
            ))}
          </div>
        </div>
      )}

      {content.optimization_suggestions?.length > 0 && (
        <div>
          <div className="text-xs text-[#8A88A8] mb-1">Optimization Suggestions</div>
          <ul className="list-disc list-inside space-y-1">
            {content.optimization_suggestions.map((s, i) => (
              <li key={i} className="text-xs text-[#EDEAF8]">{s.title} — {s.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

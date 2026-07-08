import Link from 'next/link'
import { TemplateMetrics, WorkforceTemplate } from '@/lib/types'
import { getTrustScoreColor } from '@/lib/utils'

export default function TemplateCard({ template, metrics }: { template: WorkforceTemplate; metrics: TemplateMetrics | null }) {
  return (
    <Link href={`/templates/${template.id}`} className="block bg-[#0C0D22] border border-[#3C3A58]/30 hover:border-[#6D28D9]/40 rounded-2xl p-5 transition-colors">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg text-[#EDEAF8]">{template.name}</h2>
        {template.industry && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">{template.industry}</span>
        )}
      </div>
      {template.description && <p className="text-[#8A88A8] text-sm line-clamp-2 mb-3">{template.description}</p>}
      {template.goal && <p className="text-xs text-[#8B5CF6] mb-3">🎯 {template.goal}</p>}
      <div className="flex items-center gap-3 flex-wrap text-xs text-[#8A88A8]">
        <span>{template.usage_count} deployment{template.usage_count === 1 ? '' : 's'}</span>
        {metrics && metrics.deployments_total > 0 && (
          <span className={getTrustScoreColor(metrics.deployment_success_rate)}>{metrics.deployment_success_rate.toFixed(0)}% success rate</span>
        )}
        {metrics && metrics.goals_total > 0 && (
          <span>{metrics.goal_completion_rate.toFixed(0)}% goal completion</span>
        )}
      </div>
    </Link>
  )
}

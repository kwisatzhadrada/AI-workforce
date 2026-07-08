import Link from 'next/link'
import { RankedTemplate } from '@/lib/types'
import { getTrustScoreColor } from '@/lib/utils'

export default function TemplateRankingList({ templates }: { templates: RankedTemplate[] }) {
  if (templates.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-medium text-[#EDEAF8] mb-2">Template Rankings</h3>
      <div className="space-y-2">
        {templates.map((t) => (
          <Link
            key={t.template_id}
            href={`/templates/${t.template_id}`}
            className="flex items-center justify-between text-sm bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-3 hover:border-[#6D28D9]"
          >
            <span className="text-[#EDEAF8]">#{t.rank} {t.name}</span>
            <span className="text-xs text-[#8A88A8]">
              <span className={getTrustScoreColor(t.goal_completion_rate)}>{t.goal_completion_rate.toFixed(0)}%</span> goals ·{' '}
              <span className={getTrustScoreColor(t.deployment_success_rate)}>{t.deployment_success_rate.toFixed(0)}%</span> deploys · {t.usage_count} uses
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

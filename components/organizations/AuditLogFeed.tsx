import { AuditLogEntry } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const ACTION_LABEL: Record<string, string> = {
  autonomy_level_changed: 'Autonomy level changed',
  experiment_concluded: 'A/B test concluded',
  experiment_winner_applied: 'A/B test winner applied',
  revenue_event_recorded: 'Revenue event recorded',
  campaign_launched: 'Campaign launched',
  deal_outcome_recorded: 'Deal outcome recorded',
}

export default function AuditLogFeed({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-[#8A88A8]">No audited actions yet.</p>
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.id} className="flex items-start justify-between gap-3 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-lg p-3">
          <div>
            <div className="text-sm text-[#EDEAF8]">{ACTION_LABEL[e.action] || e.action}</div>
            <div className="text-xs text-[#8A88A8]">{e.profiles?.full_name || 'System'}</div>
          </div>
          <span className="text-xs text-[#8A88A8] shrink-0">{formatTimeAgo(e.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

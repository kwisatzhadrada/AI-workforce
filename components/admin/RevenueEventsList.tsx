import { RevenueEvent } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const LABEL: Record<string, string> = {
  trial_started: 'Trial started',
  subscription_started: 'Subscription started',
  subscription_cancelled: 'Subscription cancelled',
  upgrade: 'Upgraded',
  downgrade: 'Downgraded',
}

export default function RevenueEventsList({ events }: { events: RevenueEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-[#8A88A8]">No revenue events logged yet.</p>

  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-3 text-sm border-b border-[#3C3A58]/20 last:border-0 py-2">
          <div>
            <span className="text-[#EDEAF8]">{LABEL[e.event_type] || e.event_type}</span>
            {e.amount != null && <span className="text-[#8A88A8]"> — ${e.amount}/mo</span>}
            {e.notes && <span className="text-[#8A88A8]"> · {e.notes}</span>}
          </div>
          <span className="text-xs text-[#8A88A8] shrink-0">{formatTimeAgo(e.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

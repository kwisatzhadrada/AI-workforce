import { OrganizationTimelineEvent } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const SOURCE_COLOR: Record<string, string> = {
  organization: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  sales: 'text-green-400 bg-green-400/10 border-green-400/20',
  decision: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
}

export default function TimelineFeed({ events }: { events: OrganizationTimelineEvent[] }) {
  if (events.length === 0) return <div className="text-xs text-[#8A88A8]">No activity recorded yet.</div>

  return (
    <div className="space-y-1.5">
      {events.map((e, i) => (
        <div key={i} className="flex items-start justify-between gap-3 text-xs py-1.5 border-b border-[#3C3A58]/20 last:border-0">
          <div className="min-w-0">
            <span className={`px-1.5 py-0.5 rounded border mr-2 ${SOURCE_COLOR[e.source] || ''}`}>{e.source}</span>
            <span className="text-[#EDEAF8]">{e.event_type}</span>
            {Object.keys(e.detail).length > 0 && (
              <div className="text-[#8A88A8] truncate mt-0.5">{JSON.stringify(e.detail)}</div>
            )}
          </div>
          <span className="text-[#8A88A8] shrink-0">{formatTimeAgo(e.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

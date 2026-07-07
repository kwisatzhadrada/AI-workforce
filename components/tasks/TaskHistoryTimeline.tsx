import { TaskHistoryEvent } from '@/lib/types'
import { formatTimeAgo, getTaskEventIcon, getTaskEventLabel } from '@/lib/utils'

export default function TaskHistoryTimeline({ events }: { events: TaskHistoryEvent[] }) {
  if (events.length === 0) {
    return <div className="text-sm text-[#8A88A8]">No history yet.</div>
  }

  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div key={e.id} className="flex items-center gap-3 bg-[#121428] rounded-lg px-3 py-2">
          <span className="text-base shrink-0">{getTaskEventIcon(e.event_type)}</span>
          <span className="text-sm text-[#EDEAF8] flex-1">{getTaskEventLabel(e.event_type, e.payload)}</span>
          <span className="text-xs text-[#8A88A8] shrink-0">{formatTimeAgo(e.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

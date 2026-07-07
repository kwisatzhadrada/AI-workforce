import { AgentActivity } from '@/lib/types'
import { formatTimeAgo, getActivityIcon, getActivityLabel } from '@/lib/utils'

export default function ActivityFeed({ activity }: { activity: AgentActivity[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Activity</h2>
      {activity.length === 0 ? (
        <div className="text-sm text-[#8A88A8]">No activity yet.</div>
      ) : (
        <div className="space-y-2">
          {activity.map((a) => (
            <div key={a.id} className="flex items-center gap-3 bg-[#121428] rounded-lg px-3 py-2">
              <span className="text-lg shrink-0">{getActivityIcon(a.activity_type)}</span>
              <span className="text-sm text-[#EDEAF8] flex-1">{getActivityLabel(a.activity_type, a.payload)}</span>
              <span className="text-xs text-[#8A88A8] shrink-0">{formatTimeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

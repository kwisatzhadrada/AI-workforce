import { OrganizationActivity } from '@/lib/types'
import { formatTimeAgo, getOrgActivityIcon, getOrgActivityLabel } from '@/lib/utils'

export default function OrgActivityFeed({ activity }: { activity: OrganizationActivity[] }) {
  if (activity.length === 0) {
    return <div className="text-center text-[#8A88A8] py-16">No activity yet.</div>
  }

  return (
    <div className="space-y-2">
      {activity.map((a) => (
        <div key={a.id} className="flex items-center gap-3 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl px-4 py-3">
          <span className="text-lg shrink-0">{getOrgActivityIcon(a.activity_type)}</span>
          <span className="text-sm text-[#EDEAF8] flex-1">{getOrgActivityLabel(a.activity_type, a.payload)}</span>
          <span className="text-xs text-[#8A88A8] shrink-0">{formatTimeAgo(a.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

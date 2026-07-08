import { SalesActivity } from '@/lib/types'
import { formatTimeAgo, getSalesActivityIcon, getSalesActivityLabel } from '@/lib/utils'

export default function SalesActivityFeed({ activity }: { activity: SalesActivity[] }) {
  if (activity.length === 0) {
    return <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">No sales activity yet.</div>
  }

  return (
    <div className="space-y-2">
      {activity.map((a) => (
        <div key={a.id} className="flex items-start gap-3 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-3">
          <span className="text-lg leading-none">{getSalesActivityIcon(a.activity_type)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-[#EDEAF8]">
              {getSalesActivityLabel(a.activity_type)}
              {a.contact_name ? ` — ${a.contact_name}` : a.contact_email ? ` — ${a.contact_email}` : ''}
            </div>
            <div className="text-xs text-[#8A88A8]">
              {a.contact_company && <>{a.contact_company} · </>}
              {formatTimeAgo(a.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

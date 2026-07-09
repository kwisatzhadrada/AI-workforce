import { PlatformOverview } from '@/lib/types'

export default function PlatformOverviewPanel({ overview }: { overview: PlatformOverview | null }) {
  const o = overview || {
    active_organizations: 0, connected_integrations: 0, active_campaigns: 0,
    emails_sent: 0, replies_received: 0, meetings_booked: 0,
  }

  const cards = [
    { label: 'Active Organizations', value: o.active_organizations },
    { label: 'Connected Integrations', value: o.connected_integrations },
    { label: 'Active Campaigns', value: o.active_campaigns },
    { label: 'Emails Sent', value: o.emails_sent },
    { label: 'Replies Received', value: o.replies_received },
    { label: 'Meetings Booked', value: o.meetings_booked },
  ]

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Design Partner Dashboard</h2>
      <p className="text-xs text-[#8A88A8] mb-3">Right now, not historical — active campaigns and connections today.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
            <div className="text-xs text-[#8A88A8] mb-1">{c.label}</div>
            <div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

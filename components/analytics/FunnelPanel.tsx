import { AnalyticsFunnel } from '@/lib/types'

export default function FunnelPanel({ funnel }: { funnel: AnalyticsFunnel | null }) {
  const f = funnel || {
    organizations_created: 0, workforces_deployed: 0, campaigns_launched: 0,
    emails_drafted: 0, emails_sent: 0, replies_received: 0, meetings_booked: 0,
  }

  const stages = [
    { label: 'Organizations Created', value: f.organizations_created },
    { label: 'Workforces Deployed', value: f.workforces_deployed },
    { label: 'Campaigns Launched', value: f.campaigns_launched },
    { label: 'Emails Drafted', value: f.emails_drafted },
    { label: 'Emails Sent', value: f.emails_sent },
    { label: 'Replies Received', value: f.replies_received },
    { label: 'Meetings Booked', value: f.meetings_booked },
  ]

  const max = Math.max(1, ...stages.map((s) => s.value))

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-3">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg">Funnel</h2>
      {stages.map((s) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[#8A88A8]">{s.label}</span>
            <span className="text-[#EDEAF8] font-medium tabular-nums">{s.value}</span>
          </div>
          <div className="h-2 rounded-full bg-[#121428] overflow-hidden">
            <div className="h-full bg-[#6D28D9]" style={{ width: `${(s.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

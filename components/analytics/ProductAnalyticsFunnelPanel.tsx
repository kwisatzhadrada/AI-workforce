import { ProductAnalyticsFunnel } from '@/lib/types'

export default function ProductAnalyticsFunnelPanel({ funnel }: { funnel: ProductAnalyticsFunnel | null }) {
  const f = funnel || {
    signups: 0, onboarding_completion: 0, gmail_connections: 0, campaign_launches: 0,
    first_email_sent: 0, first_reply_received: 0, first_meeting_booked: 0,
  }

  const stages = [
    { label: 'Signed Up', value: f.signups },
    { label: 'Deployed a Workforce', value: f.onboarding_completion },
    { label: 'Connected Gmail', value: f.gmail_connections },
    { label: 'Launched a Campaign', value: f.campaign_launches },
    { label: 'Sent First Email', value: f.first_email_sent },
    { label: 'Received First Reply', value: f.first_reply_received },
    { label: 'Booked First Meeting', value: f.first_meeting_booked },
  ]

  const max = Math.max(1, stages[0].value)

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-1">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Product Funnel: Signup → First Meeting</h2>
      <p className="text-xs text-[#8A88A8] mb-3">
        Exactly where a new user drops off between creating an account and booking their first real meeting — each stage counts distinct organizations.
      </p>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null
        const dropOffPct = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null
        const ofFirstPct = max > 0 ? Math.round((s.value / max) * 100) : 0
        return (
          <div key={s.label} className="py-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#8A88A8]">{s.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-[#EDEAF8] font-medium tabular-nums">{s.value}</span>
                {dropOffPct !== null && dropOffPct > 0 && (
                  <span className="text-red-400 tabular-nums">−{dropOffPct}%</span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#121428] overflow-hidden">
              <div className="h-full bg-[#6D28D9]" style={{ width: `${ofFirstPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

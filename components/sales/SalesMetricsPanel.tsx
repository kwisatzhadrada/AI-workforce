import { SalesMetrics } from '@/lib/types'

export default function SalesMetricsPanel({ metrics }: { metrics: SalesMetrics | null }) {
  const m = metrics || { leads_found: 0, emails_sent: 0, replies_received: 0, meetings_booked: 0, reply_rate: 0 }

  const cards = [
    { label: 'Leads Found', value: m.leads_found },
    { label: 'Emails Sent', value: m.emails_sent },
    { label: 'Replies Received', value: m.replies_received },
    { label: 'Meetings Booked', value: m.meetings_booked },
  ]

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
            <div className="text-xs text-[#8A88A8] mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-[#EDEAF8]">{c.value}</div>
          </div>
        ))}
      </div>
      {m.emails_sent > 0 && (
        <p className="text-xs text-[#8A88A8]">Reply rate: <span className="text-[#EDEAF8] font-medium">{m.reply_rate.toFixed(1)}%</span></p>
      )}
    </div>
  )
}

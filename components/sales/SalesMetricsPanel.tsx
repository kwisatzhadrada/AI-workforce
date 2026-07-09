import { SalesMetrics } from '@/lib/types'

export default function SalesMetricsPanel({ metrics, showPipelineValue = false }: { metrics: SalesMetrics | null; showPipelineValue?: boolean }) {
  const m = metrics || { leads_found: 0, emails_sent: 0, replies_received: 0, meetings_booked: 0, reply_rate: 0, avg_deal_value: null, estimated_pipeline_value: 0 }

  const cards = [
    { label: 'Prospects Found', value: m.leads_found },
    { label: 'Emails Sent', value: m.emails_sent },
    { label: 'Replies', value: m.replies_received },
    { label: 'Meetings Booked', value: m.meetings_booked },
  ]

  const conversionRate = m.leads_found > 0 ? ((m.meetings_booked / m.leads_found) * 100).toFixed(1) : '0.0'

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
      <div className="flex flex-wrap gap-4 text-xs text-[#8A88A8]">
        <p>Conversion rate (prospects → meetings): <span className="text-[#EDEAF8] font-medium">{conversionRate}%</span></p>
        {m.emails_sent > 0 && <p>Reply rate: <span className="text-[#EDEAF8] font-medium">{m.reply_rate.toFixed(1)}%</span></p>}
      </div>
      {showPipelineValue && (
        <div className="mt-3 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Estimated Pipeline Value</div>
          <div className="text-2xl font-bold text-[#EDEAF8]">
            ${m.estimated_pipeline_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-[#8A88A8] mt-1">
            {m.avg_deal_value != null
              ? `${m.meetings_booked} meeting${m.meetings_booked === 1 ? '' : 's'} booked × $${m.avg_deal_value.toLocaleString()} average deal value`
              : 'Set an average deal value below to estimate pipeline value'}
          </div>
        </div>
      )}
    </div>
  )
}

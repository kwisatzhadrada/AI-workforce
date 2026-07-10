import { RevenueAttribution } from '@/lib/types'

function formatValue(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function RevenueAttributionPanel({ attribution }: { attribution: RevenueAttribution | null }) {
  if (!attribution) {
    return (
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
        <h3 className="font-medium text-[#EDEAF8] mb-1">Revenue Attribution</h3>
        <p className="text-sm text-[#8A88A8] mt-2">No deal outcomes recorded yet.</p>
      </div>
    )
  }

  const hasBreakdowns = attribution.by_icp.length > 0 || attribution.by_subject_line.length > 0

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-1">Revenue Attribution</h3>
      <p className="text-xs text-[#8A88A8] mb-3">Which campaigns, ICPs, and subject lines actually produced revenue — no estimates.</p>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
          <div className="text-xs text-[#8A88A8]">Open Pipeline</div>
          <div className="text-lg font-bold text-[#EDEAF8] tabular-nums">{formatValue(attribution.pipeline_open)}</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
          <div className="text-xs text-[#8A88A8]">Revenue Won</div>
          <div className="text-lg font-bold text-green-400 tabular-nums">{formatValue(attribution.revenue_won)}</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
          <div className="text-xs text-[#8A88A8]">Revenue Lost</div>
          <div className="text-lg font-bold text-red-400 tabular-nums">{formatValue(attribution.revenue_lost)}</div>
        </div>
      </div>

      {hasBreakdowns && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attribution.by_icp.length > 0 && (
            <div>
              <div className="text-xs text-[#8A88A8] mb-2">Revenue won by ICP</div>
              <div className="space-y-1.5">
                {attribution.by_icp.map((row) => (
                  <div key={row.industry} className="flex items-center justify-between bg-[#121428] border border-[#3C3A58]/30 rounded-lg px-3 py-2 text-xs">
                    <span className="text-[#EDEAF8]">{row.industry}</span>
                    <span className="text-green-400 tabular-nums">{formatValue(row.revenue_won)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {attribution.by_subject_line.length > 0 && (
            <div>
              <div className="text-xs text-[#8A88A8] mb-2">Revenue won by subject line</div>
              <div className="space-y-1.5">
                {attribution.by_subject_line.map((row) => (
                  <div key={row.subject_line} className="flex items-center justify-between bg-[#121428] border border-[#3C3A58]/30 rounded-lg px-3 py-2 text-xs gap-2">
                    <span className="text-[#EDEAF8] truncate">&ldquo;{row.subject_line}&rdquo;</span>
                    <span className="text-green-400 tabular-nums shrink-0">{formatValue(row.revenue_won)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { Opportunities } from '@/lib/types'

function formatValue(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function OpportunitiesPanel({ opportunities }: { opportunities: Opportunities | null }) {
  const hasAny = opportunities && (
    opportunities.stalled_campaign ||
    opportunities.high_value_prospects.length > 0 ||
    opportunities.winning_icp ||
    opportunities.failing_icp
  )

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-1">Opportunities</h3>
      <p className="text-xs text-[#8A88A8] mb-3">What to act on right now, detected from real campaign and pipeline data.</p>
      {!hasAny ? (
        <p className="text-sm text-[#8A88A8]">Nothing surfaced yet — keep the campaign running to build up signal.</p>
      ) : (
        <div className="space-y-3">
          {opportunities?.stalled_campaign && (
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
              <div className="text-sm text-yellow-400">Campaign stalled</div>
              <div className="text-xs text-[#8A88A8] mt-1">Active, but no outreach activity in the last 7 days.</div>
            </div>
          )}

          {(opportunities?.winning_icp || opportunities?.failing_icp) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {opportunities?.winning_icp && (
                <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
                  <div className="text-xs text-[#8A88A8] mb-1">Winning ICP</div>
                  <div className="text-sm text-[#EDEAF8]">{opportunities.winning_icp.targetIndustry || 'Unspecified industry'}</div>
                  {opportunities.winning_icp.companySize && <div className="text-xs text-[#8A88A8] mt-1">{opportunities.winning_icp.companySize}</div>}
                </div>
              )}
              {opportunities?.failing_icp && (
                <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
                  <div className="text-xs text-[#8A88A8] mb-1">Failing ICP</div>
                  <div className="text-sm text-[#EDEAF8]">{opportunities.failing_icp.targetIndustry || 'Unspecified industry'}</div>
                  {opportunities.failing_icp.companySize && <div className="text-xs text-[#8A88A8] mt-1">{opportunities.failing_icp.companySize}</div>}
                </div>
              )}
            </div>
          )}

          {opportunities && opportunities.high_value_prospects.length > 0 && (
            <div>
              <div className="text-xs text-[#8A88A8] mb-2">High-value prospects</div>
              <div className="space-y-1.5">
                {opportunities.high_value_prospects.map((p) => (
                  <div key={p.contact_email} className="flex items-center justify-between bg-[#121428] border border-[#3C3A58]/30 rounded-lg px-3 py-2 text-xs">
                    <span className="text-[#EDEAF8]">{p.contact_name || p.contact_email}</span>
                    <span className="text-green-400 tabular-nums">{formatValue(p.estimated_value)}</span>
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

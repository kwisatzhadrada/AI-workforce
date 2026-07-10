import { BusinessOutcomes } from '@/lib/types'

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Real Business Outcomes — every number here is a direct measurement
// (a count, or a sum of dollar values a human actually entered). No
// multiplication-based estimate, no AI scoring, no prediction belongs in
// this component; the estimate-based ROI view lives in CampaignRoiCard.
export default function BusinessOutcomesPanel({ outcomes }: { outcomes: BusinessOutcomes | null }) {
  const o = outcomes || { meetings_booked: 0, opportunities_created: 0, positive_replies: 0, pipeline_generated: 0 }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-1">Business Outcomes</h3>
      <p className="text-xs text-[#8A88A8] mb-3">Real, measured outcomes only — no estimates, no scoring, no predictions.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Meetings Booked</div>
          <div className="text-2xl font-bold text-[#EDEAF8] tabular-nums">{o.meetings_booked}</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Positive Replies</div>
          <div className="text-2xl font-bold text-[#EDEAF8] tabular-nums">{o.positive_replies}</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Opportunities Created</div>
          <div className="text-2xl font-bold text-[#EDEAF8] tabular-nums">{o.opportunities_created}</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
          <div className="text-xs text-[#8A88A8] mb-1">Pipeline Generated</div>
          <div className="text-2xl font-bold text-green-400 tabular-nums">{formatCurrency(o.pipeline_generated)}</div>
        </div>
      </div>
    </div>
  )
}

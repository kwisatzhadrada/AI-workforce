import { CampaignRoi } from '@/lib/campaigns'

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function CampaignRoiCard({ roi }: { roi: CampaignRoi | null }) {
  const r = roi || { meetingsBooked: 0, pipelineValue: 0, costEstimate: 0 }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-3">ROI</h3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-[#8A88A8]">Meetings</div>
          <div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{r.meetingsBooked}</div>
        </div>
        <div>
          <div className="text-xs text-[#8A88A8]">Estimated Pipeline Value</div>
          <div className="text-xl font-bold text-green-400 tabular-nums">{formatCurrency(r.pipelineValue)}</div>
        </div>
        <div>
          <div className="text-xs text-[#8A88A8]">Cost to Run</div>
          <div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{formatCurrency(r.costEstimate)}</div>
        </div>
      </div>
      {r.pipelineValue === 0 && (
        <p className="text-xs text-[#8A88A8] mt-3">
          Pipeline value is meetings booked × your average deal value — set an average deal value below to see it here.
        </p>
      )}
    </div>
  )
}

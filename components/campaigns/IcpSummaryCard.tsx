import { CampaignIcp } from '@/lib/campaigns'

export default function IcpSummaryCard({ icp }: { icp: CampaignIcp | null }) {
  if (!icp || (!icp.targetIndustry && !icp.companySize && !icp.location && !icp.icpDescription)) return null

  const fields = [
    { label: 'Industry', value: icp.targetIndustry },
    { label: 'Company Size', value: icp.companySize },
    { label: 'Location', value: icp.location },
  ].filter((f) => f.value)

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-3">Ideal Customer Profile</h3>
      {fields.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-2">
          {fields.map((f) => (
            <div key={f.label}>
              <div className="text-xs text-[#8A88A8]">{f.label}</div>
              <div className="text-sm text-[#EDEAF8]">{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {icp.icpDescription && <p className="text-xs text-[#8A88A8]">{icp.icpDescription}</p>}
    </div>
  )
}

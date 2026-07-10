import { HealthStatus } from '@/lib/types'

const HEALTH_COLOR: Record<HealthStatus, string> = {
  healthy: 'text-green-400',
  at_risk: 'text-yellow-400',
  critical: 'text-red-400',
}
const HEALTH_LABEL: Record<HealthStatus, string> = { healthy: 'Healthy', at_risk: 'At Risk', critical: 'Critical' }

export default function FounderCustomerSuccessPanel({
  healthCounts, onboardingCompletionPct, openSupportConversations,
}: {
  healthCounts: Record<HealthStatus, number>
  onboardingCompletionPct: number
  openSupportConversations: number
}) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Customer Success</h2>
      <p className="text-xs text-[#8A88A8] mb-4">Partner health, how far onboarding gets, and current support load.</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(Object.keys(HEALTH_LABEL) as HealthStatus[]).map((h) => (
          <div key={h} className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold tabular-nums ${HEALTH_COLOR[h]}`}>{healthCounts[h]}</div>
            <div className="text-xs text-[#8A88A8] mt-0.5">{HEALTH_LABEL[h]}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
          <div className="text-xs text-[#8A88A8]">Onboarding Completion</div>
          <div className="text-lg font-bold text-[#EDEAF8] tabular-nums">{onboardingCompletionPct}%</div>
          <div className="text-xs text-[#8A88A8]">signed up → launched a campaign</div>
        </div>
        <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
          <div className="text-xs text-[#8A88A8]">Open Support Volume</div>
          <div className={`text-lg font-bold tabular-nums ${openSupportConversations > 0 ? 'text-yellow-400' : 'text-[#EDEAF8]'}`}>{openSupportConversations}</div>
          <div className="text-xs text-[#8A88A8]">conversations awaiting a reply</div>
        </div>
      </div>
    </div>
  )
}

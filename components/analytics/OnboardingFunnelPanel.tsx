import { OnboardingFunnel } from '@/lib/types'

export default function OnboardingFunnelPanel({ funnel }: { funnel: OnboardingFunnel | null }) {
  const f = funnel || {
    accounts_created: 0, organizations_created: 0, workforces_deployed: 0,
    integrations_connected: 0, campaigns_created: 0, campaigns_approved: 0, first_email_sent: 0,
  }

  const stages = [
    { label: 'Account Created', value: f.accounts_created },
    { label: 'Organization Created', value: f.organizations_created },
    { label: 'Workforce Deployed', value: f.workforces_deployed },
    { label: 'Integrations Connected', value: f.integrations_connected },
    { label: 'Campaign Created', value: f.campaigns_created },
    { label: 'Campaign Approved', value: f.campaigns_approved },
    { label: 'First Email Sent', value: f.first_email_sent },
  ]

  const max = Math.max(1, stages[0].value)

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-1">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Onboarding Funnel</h2>
      <p className="text-xs text-[#8A88A8] mb-3">
        Where design partners drop off — each stage after Account Created counts distinct organizations, not raw events.
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

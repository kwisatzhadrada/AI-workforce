import { PartnerFunnel } from '@/lib/types'

function FunnelGroup({ title, stages }: { title: string; stages: { label: string; value: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value))
  return (
    <div>
      <h3 className="text-sm font-medium text-[#EDEAF8] mb-2">{title}</h3>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].value : null
          const dropOffPct = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null
          const widthPct = max > 0 ? Math.round((s.value / max) * 100) : 0
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8A88A8]">{s.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[#EDEAF8] font-medium tabular-nums">{s.value}</span>
                  {dropOffPct !== null && dropOffPct > 0 && <span className="text-red-400 tabular-nums">−{dropOffPct}%</span>}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#121428] overflow-hidden">
                <div className="h-full bg-[#6D28D9]" style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PartnerFunnelPanel({ funnel }: { funnel: PartnerFunnel | null }) {
  const f = funnel || {
    signups: 0, workspaces_created: 0, gmail_connected: 0, crm_connected: 0, icp_submitted: 0, campaigns_launched: 0,
    logins: 0, active_campaigns: 0, replies_reviewed: 0, approvals_completed: 0,
    meetings_booked: 0, opportunities_created: 0, revenue_tracked: 0,
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-5">
      <div>
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Design Partner Funnel</h2>
        <p className="text-xs text-[#8A88A8]">Activation, engagement, and value — each stage counts distinct organizations that reached it.</p>
      </div>

      <FunnelGroup
        title="Activation"
        stages={[
          { label: 'Signed Up', value: f.signups },
          { label: 'Workspace Created', value: f.workspaces_created },
          { label: 'Gmail Connected', value: f.gmail_connected },
          { label: 'CRM Connected', value: f.crm_connected },
          { label: 'ICP Submitted', value: f.icp_submitted },
          { label: 'Campaign Launched', value: f.campaigns_launched },
        ]}
      />

      <FunnelGroup
        title="Engagement"
        stages={[
          { label: 'Logged In', value: f.logins },
          { label: 'Active Campaigns', value: f.active_campaigns },
          { label: 'Replies Reviewed', value: f.replies_reviewed },
          { label: 'Approvals Completed', value: f.approvals_completed },
        ]}
      />

      <FunnelGroup
        title="Value"
        stages={[
          { label: 'Meetings Booked', value: f.meetings_booked },
          { label: 'Opportunities Created', value: f.opportunities_created },
          { label: 'Revenue Tracked', value: f.revenue_tracked },
        ]}
      />
    </div>
  )
}

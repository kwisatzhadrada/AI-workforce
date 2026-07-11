import { AnalyticsFunnel, PartnerFunnel, PlatformOverview } from '@/lib/types'

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—'
  return `${Math.round((numerator / denominator) * 100)}%`
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
      <div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{value}</div>
      <div className="text-xs text-[#8A88A8] mt-0.5">{label}</div>
    </div>
  )
}

// The exact 8 numbers this sprint's mission asked for, nothing else —
// every other panel on this page is real detail kept for whoever wants
// to dig in, but this is the one screenful a founder should need to
// answer "is this working" without scrolling.
export default function FounderKeyMetricsPanel({
  overview, partnerFunnel, salesFunnel,
}: {
  overview: PlatformOverview | null
  partnerFunnel: PartnerFunnel | null
  salesFunnel: AnalyticsFunnel | null
}) {
  const signups = partnerFunnel?.signups ?? 0
  const activeOrgs = overview?.active_organizations ?? 0
  const connectedIntegrations = overview?.connected_integrations ?? 0
  const campaignsLaunched = salesFunnel?.campaigns_launched ?? 0
  const emailsSent = salesFunnel?.emails_sent ?? 0
  const repliesReceived = salesFunnel?.replies_received ?? 0
  const meetingsBooked = salesFunnel?.meetings_booked ?? 0
  const replyRate = pct(repliesReceived, emailsSent)
  const meetingRate = pct(meetingsBooked, repliesReceived)

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">At a Glance</h2>
      <p className="text-xs text-[#8A88A8] mb-4">The numbers that answer: is this working, right now.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Stat label="New Signups" value={signups} />
        <Stat label="Active Organizations" value={activeOrgs} />
        <Stat label="Connected Integrations" value={connectedIntegrations} />
        <Stat label="Campaigns Launched" value={campaignsLaunched} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Emails Sent" value={emailsSent} />
        <Stat label="Replies Received" value={repliesReceived} />
        <Stat label="Meetings Booked" value={meetingsBooked} />
        <Stat label="Reply → Meeting Rate" value={`${replyRate} / ${meetingRate}`} />
      </div>
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HealthStatus } from '@/lib/types'
import { getAnalyticsByOrganization } from '@/lib/analytics'
import { getDesignPartnerCohort, getDesignPartners } from '@/lib/designPartners'
import { getAllFeedback } from '@/lib/feedback'
import { getOrganizationHealth } from '@/lib/health'
import { getRevenueMetrics } from '@/lib/revenue'
import { getRevenueAttribution } from '@/lib/revenueAttribution'
import { getAllConversations } from '@/lib/supportConversations'
import DesignPartnerRow, { DesignPartnerRowData } from '@/components/admin/DesignPartnerRow'
import DesignPartnerCohortPanel from '@/components/admin/DesignPartnerCohortPanel'
import RevenueMetricsPanel from '@/components/admin/RevenueMetricsPanel'

export const dynamic = 'force-dynamic'

const HEALTH_FILTERS: { value: HealthStatus; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'critical', label: 'Critical' },
]

export default async function DesignPartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const healthFilter = typeof sp.health === 'string' ? sp.health : ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const [usageRows, designPartners, feedback, cohort, revenueMetrics, allConversations, { data: orgFields }] = await Promise.all([
    getAnalyticsByOrganization(supabase),
    getDesignPartners(supabase),
    getAllFeedback(supabase),
    getDesignPartnerCohort(supabase),
    getRevenueMetrics(supabase),
    getAllConversations(supabase),
    supabase.from('organizations').select('id, industry, company_size'),
  ])

  const partnerByOrg = new Map(designPartners.map((p) => [p.organization_id, p]))
  const orgFieldsById = new Map(((orgFields as { id: string; industry: string | null; company_size: string | null }[]) || []).map((o) => [o.id, o]))
  const feedbackCountByOrg = new Map<string, number>()
  for (const f of feedback) {
    if (!f.organization_id) continue
    feedbackCountByOrg.set(f.organization_id, (feedbackCountByOrg.get(f.organization_id) || 0) + 1)
  }

  // Open support conversations per organization — real counts from the
  // same conversations already shown on /admin/support, not a new query path.
  const openConversationsByOrg = new Map<string, number>()
  for (const c of allConversations) {
    if (!c.organization_id || c.status === 'resolved' || c.status === 'closed') continue
    openConversationsByOrg.set(c.organization_id, (openConversationsByOrg.get(c.organization_id) || 0) + 1)
  }

  // Health scores and revenue attribution are real queries per tracked
  // partner, not per every organization on the platform — cheap at
  // design-partner scale (a handful of rows), and skipped entirely for
  // orgs nobody is tracking.
  const healthByOrg = new Map<string, Awaited<ReturnType<typeof getOrganizationHealth>>>()
  const revenueByOrg = new Map<string, Awaited<ReturnType<typeof getRevenueAttribution>>>()
  await Promise.all(
    designPartners.map(async (p) => {
      const [health, attribution] = await Promise.all([
        getOrganizationHealth(supabase, p.organization_id),
        getRevenueAttribution(supabase, p.organization_id),
      ])
      healthByOrg.set(p.organization_id, health)
      revenueByOrg.set(p.organization_id, attribution)
    })
  )

  const rows: DesignPartnerRowData[] = usageRows.map((u) => {
    const partner = partnerByOrg.get(u.organization_id)
    const orgFields = orgFieldsById.get(u.organization_id)
    const health = healthByOrg.get(u.organization_id)
    const attribution = revenueByOrg.get(u.organization_id)

    return {
      organizationId: u.organization_id,
      organizationName: u.organization_name,
      industry: orgFields?.industry || null,
      companySize: orgFields?.company_size || null,
      contactName: partner?.contact_name || null,
      contactEmail: partner?.contact_email || null,
      contactRole: partner?.contact_role || null,
      status: partner?.status || 'prospect',
      satisfactionScore: partner?.satisfaction_score ?? null,
      requestedFeatures: partner?.requested_features || null,
      feedbackNotes: partner?.feedback_notes || null,
      meetingNotes: partner?.meeting_notes || null,
      organizationsCreated: 1,
      campaignsLaunched: u.campaign_launched ? 1 : 0,
      emailsSent: u.emails_sent,
      repliesReceived: u.replies_received,
      meetingsBooked: u.meetings_booked,
      healthStatus: health?.health_status || null,
      revenueWon: attribution?.revenue_won ?? null,
      pipelineOpen: attribution?.pipeline_open ?? null,
      openSupportConversations: openConversationsByOrg.get(u.organization_id) || 0,
    }
  })

  const filteredRows = healthFilter ? rows.filter((r) => r.healthStatus === healthFilter) : rows

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Design Partner Operations Center</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          Real usage, health, and revenue for every design partner — plus every organization on the platform, so a new one can be added the moment it's worth tracking. Admin only.
        </p>
      </div>

      <RevenueMetricsPanel metrics={revenueMetrics} />
      <DesignPartnerCohortPanel rows={cohort} />

      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg">All Organizations</h2>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/admin/design-partners" className={`text-xs px-2.5 py-1 rounded-lg border ${!healthFilter ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>
              All health
            </Link>
            {HEALTH_FILTERS.map((h) => (
              <Link key={h.value} href={`/admin/design-partners?health=${healthFilter === h.value ? '' : h.value}`} className={`text-xs px-2.5 py-1 rounded-lg border ${healthFilter === h.value ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>
                {h.label}
              </Link>
            ))}
          </div>
        </div>
        {filteredRows.length === 0 ? (
          <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
            {rows.length === 0 ? 'No organizations yet.' : 'No organizations match this health filter.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((r) => (
              <DesignPartnerRow key={r.organizationId} data={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAnalyticsByOrganization } from '@/lib/analytics'
import { getDesignPartnerCohort, getDesignPartners } from '@/lib/designPartners'
import { getAllFeedback } from '@/lib/feedback'
import { getOrganizationHealth } from '@/lib/health'
import { getRevenueMetrics } from '@/lib/revenue'
import DesignPartnerRow, { DesignPartnerRowData } from '@/components/admin/DesignPartnerRow'
import DesignPartnerCohortPanel from '@/components/admin/DesignPartnerCohortPanel'
import RevenueMetricsPanel from '@/components/admin/RevenueMetricsPanel'

export const dynamic = 'force-dynamic'

export default async function DesignPartnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const [usageRows, designPartners, feedback, cohort, revenueMetrics, { data: orgFields }] = await Promise.all([
    getAnalyticsByOrganization(supabase),
    getDesignPartners(supabase),
    getAllFeedback(supabase),
    getDesignPartnerCohort(supabase),
    getRevenueMetrics(supabase),
    supabase.from('organizations').select('id, industry, company_size'),
  ])

  const partnerByOrg = new Map(designPartners.map((p) => [p.organization_id, p]))
  const orgFieldsById = new Map(((orgFields as { id: string; industry: string | null; company_size: string | null }[]) || []).map((o) => [o.id, o]))
  const feedbackCountByOrg = new Map<string, number>()
  for (const f of feedback) {
    if (!f.organization_id) continue
    feedbackCountByOrg.set(f.organization_id, (feedbackCountByOrg.get(f.organization_id) || 0) + 1)
  }

  // Health scores are a real query per tracked partner, not per every
  // organization on the platform — cheap at design-partner scale (a
  // handful of rows), and skipped entirely for orgs nobody is tracking.
  const healthByOrg = new Map<string, Awaited<ReturnType<typeof getOrganizationHealth>>>()
  await Promise.all(
    designPartners.map(async (p) => {
      healthByOrg.set(p.organization_id, await getOrganizationHealth(supabase, p.organization_id))
    })
  )

  const rows: DesignPartnerRowData[] = usageRows.map((u) => {
    const partner = partnerByOrg.get(u.organization_id)
    const orgFields = orgFieldsById.get(u.organization_id)
    const health = healthByOrg.get(u.organization_id)

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
    }
  })

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
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">All Organizations</h2>
        {rows.length === 0 ? (
          <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
            No organizations yet.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <DesignPartnerRow key={r.organizationId} data={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAnalyticsByOrganization } from '@/lib/analytics'
import { getDesignPartners } from '@/lib/designPartners'
import { getAllFeedback } from '@/lib/feedback'
import DesignPartnerRow, { DesignPartnerRowData } from '@/components/admin/DesignPartnerRow'

export const dynamic = 'force-dynamic'

export default async function DesignPartnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const [usageRows, designPartners, feedback] = await Promise.all([
    getAnalyticsByOrganization(supabase),
    getDesignPartners(supabase),
    getAllFeedback(supabase),
  ])

  const partnerByOrg = new Map(designPartners.map((p) => [p.organization_id, p]))
  const feedbackCountByOrg = new Map<string, number>()
  for (const f of feedback) {
    if (!f.organization_id) continue
    feedbackCountByOrg.set(f.organization_id, (feedbackCountByOrg.get(f.organization_id) || 0) + 1)
  }

  const rows: DesignPartnerRowData[] = usageRows.map((u) => {
    const partner = partnerByOrg.get(u.organization_id)
    const usageSignal = !u.workforce_deployed
      ? 'No workforce deployed'
      : !u.campaign_launched
        ? 'Workforce deployed, no campaign'
        : `${u.emails_sent} email(s) sent`

    return {
      organizationId: u.organization_id,
      organizationName: u.organization_name,
      contactName: partner?.contact_name || null,
      contactEmail: partner?.contact_email || null,
      contactRole: partner?.contact_role || null,
      status: partner?.status || 'active',
      satisfactionScore: partner?.satisfaction_score ?? null,
      requestedFeatures: partner?.requested_features || null,
      notes: partner?.notes || null,
      usageSignal,
      meetingsBooked: u.meetings_booked,
      feedbackCount: feedbackCountByOrg.get(u.organization_id) || 0,
    }
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Design Partners</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          Internal CRM for every organization on the platform — contact, real usage, meetings booked, feedback volume, and satisfaction. Admin only.
        </p>
      </div>

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
  )
}

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationJourney } from '@/lib/journey'
import { getOrganizationHealth, getBusinessOutcomes } from '@/lib/health'
import { getRevenueEvents } from '@/lib/revenue'
import { getDesignPartnerReports } from '@/lib/designPartnerReports'
import JourneyTimeline from '@/components/admin/JourneyTimeline'
import HealthBadge from '@/components/admin/HealthBadge'
import BusinessOutcomesPanel from '@/components/dashboard/BusinessOutcomesPanel'
import RevenueEventForm from '@/components/admin/RevenueEventForm'
import RevenueEventsList from '@/components/admin/RevenueEventsList'
import DesignPartnerReportPanel from '@/components/admin/DesignPartnerReportPanel'

export const dynamic = 'force-dynamic'

export default async function DesignPartnerDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const { data: org } = await supabase.from('organizations').select('id, name, industry, company_size').eq('id', orgId).maybeSingle()
  if (!org) notFound()

  const [journey, health, outcomes, revenueEvents, reports] = await Promise.all([
    getOrganizationJourney(supabase, orgId),
    getOrganizationHealth(supabase, orgId),
    getBusinessOutcomes(supabase, orgId),
    getRevenueEvents(supabase, orgId),
    getDesignPartnerReports(supabase, orgId),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/admin/design-partners" className="text-xs text-[#6D28D9] hover:underline">← Design Partner Operations Center</Link>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold">{org.name}</h1>
          {health && <HealthBadge status={health.health_status} />}
        </div>
        <p className="text-[#8A88A8] text-sm mt-1">{[org.industry, org.company_size].filter(Boolean).join(' · ') || 'No industry/size on file'}</p>
      </div>

      {health && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Health Scores</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Adoption</div>
              <div className="text-2xl font-bold text-[#EDEAF8] tabular-nums">{health.adoption_score}</div>
            </div>
            <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Success</div>
              <div className="text-2xl font-bold text-[#EDEAF8] tabular-nums">{health.success_score}</div>
            </div>
            <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Risk</div>
              <div className="text-2xl font-bold text-[#EDEAF8] tabular-nums">{health.risk_score}</div>
            </div>
          </div>
        </div>
      )}

      <BusinessOutcomesPanel outcomes={outcomes} />

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Journey Replay</h2>
        <JourneyTimeline milestones={journey} />
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-3">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg">Revenue</h2>
        <RevenueEventForm organizationId={orgId} />
        <RevenueEventsList events={revenueEvents} />
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Design Partner Report</h2>
        <DesignPartnerReportPanel organizationId={orgId} reports={reports} />
      </div>
    </div>
  )
}

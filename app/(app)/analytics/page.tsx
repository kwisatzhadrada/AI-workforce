import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAnalyticsByOrganization, getAnalyticsFunnel, getOnboardingFunnel, getPartnerFunnel, getPlatformOverview, getProductAnalyticsFunnel } from '@/lib/analytics'
import { getDesignPartners } from '@/lib/designPartners'
import { getOrganizationHealth } from '@/lib/health'
import { getRevenueMetrics } from '@/lib/revenue'
import { getAllFeedback } from '@/lib/feedback'
import { getAllConversations } from '@/lib/supportConversations'
import { HealthStatus } from '@/lib/types'
import FunnelPanel from '@/components/analytics/FunnelPanel'
import OnboardingFunnelPanel from '@/components/analytics/OnboardingFunnelPanel'
import ProductAnalyticsFunnelPanel from '@/components/analytics/ProductAnalyticsFunnelPanel'
import PartnerFunnelPanel from '@/components/analytics/PartnerFunnelPanel'
import PlatformOverviewPanel from '@/components/analytics/PlatformOverviewPanel'
import OrganizationsTable from '@/components/analytics/OrganizationsTable'
import RevenueMetricsPanel from '@/components/admin/RevenueMetricsPanel'
import FounderCustomerSuccessPanel from '@/components/analytics/FounderCustomerSuccessPanel'
import FounderProductPanel from '@/components/analytics/FounderProductPanel'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const [overview, onboardingFunnel, productFunnel, partnerFunnel, salesFunnel, organizations, revenueMetrics, designPartners, feedback, conversations] = await Promise.all([
    getPlatformOverview(supabase),
    getOnboardingFunnel(supabase),
    getProductAnalyticsFunnel(supabase),
    getPartnerFunnel(supabase),
    getAnalyticsFunnel(supabase),
    getAnalyticsByOrganization(supabase),
    getRevenueMetrics(supabase),
    getDesignPartners(supabase),
    getAllFeedback(supabase),
    getAllConversations(supabase),
  ])

  // Health distribution across tracked design partners — same per-partner
  // query the Design Partner Ops Center runs, cheap at this scale.
  const healthCounts: Record<HealthStatus, number> = { healthy: 0, at_risk: 0, critical: 0 }
  await Promise.all(
    designPartners.map(async (p) => {
      const health = await getOrganizationHealth(supabase, p.organization_id)
      if (health) healthCounts[health.health_status] += 1
    })
  )

  const onboardingCompletionPct = partnerFunnel && partnerFunnel.signups > 0
    ? Math.round((partnerFunnel.campaigns_launched / partnerFunnel.signups) * 100)
    : 0

  const openSupportConversations = conversations.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Analytics</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          The founder dashboard: who&apos;s using the product, where they get stuck, whether they&apos;re getting
          real value, and what to build next.
        </p>
      </div>

      <PlatformOverviewPanel overview={overview} />
      <RevenueMetricsPanel metrics={revenueMetrics} />
      <FounderCustomerSuccessPanel
        healthCounts={healthCounts}
        onboardingCompletionPct={onboardingCompletionPct}
        openSupportConversations={openSupportConversations}
      />
      <PartnerFunnelPanel funnel={partnerFunnel} />
      <FounderProductPanel feedback={feedback} />
      <ProductAnalyticsFunnelPanel funnel={productFunnel} />
      <OnboardingFunnelPanel funnel={onboardingFunnel} />
      <FunnelPanel funnel={salesFunnel} />
      <OrganizationsTable rows={organizations} />
    </div>
  )
}

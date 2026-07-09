import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAnalyticsByOrganization, getAnalyticsFunnel, getOnboardingFunnel, getPlatformOverview, getProductAnalyticsFunnel } from '@/lib/analytics'
import FunnelPanel from '@/components/analytics/FunnelPanel'
import OnboardingFunnelPanel from '@/components/analytics/OnboardingFunnelPanel'
import ProductAnalyticsFunnelPanel from '@/components/analytics/ProductAnalyticsFunnelPanel'
import PlatformOverviewPanel from '@/components/analytics/PlatformOverviewPanel'
import OrganizationsTable from '@/components/analytics/OrganizationsTable'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const [overview, onboardingFunnel, productFunnel, salesFunnel, organizations] = await Promise.all([
    getPlatformOverview(supabase),
    getOnboardingFunnel(supabase),
    getProductAnalyticsFunnel(supabase),
    getAnalyticsFunnel(supabase),
    getAnalyticsByOrganization(supabase),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Analytics</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          Design partner dashboard: who&apos;s active right now, where onboarding drops off, and the real sales
          pipeline every organization produced.
        </p>
      </div>

      <PlatformOverviewPanel overview={overview} />
      <ProductAnalyticsFunnelPanel funnel={productFunnel} />
      <OnboardingFunnelPanel funnel={onboardingFunnel} />
      <FunnelPanel funnel={salesFunnel} />
      <OrganizationsTable rows={organizations} />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAnalyticsByOrganization, getAnalyticsFunnel } from '@/lib/analytics'
import FunnelPanel from '@/components/analytics/FunnelPanel'
import OrganizationsTable from '@/components/analytics/OrganizationsTable'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const [funnel, organizations] = await Promise.all([
    getAnalyticsFunnel(supabase),
    getAnalyticsByOrganization(supabase),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Analytics</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          Real usage across every organization — organizations created, workforces deployed, campaigns launched,
          and the real sales pipeline they produced.
        </p>
      </div>

      <FunnelPanel funnel={funnel} />
      <OrganizationsTable rows={organizations} />
    </div>
  )
}

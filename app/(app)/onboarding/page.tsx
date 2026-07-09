import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: template } = await supabase
    .from('workforce_templates')
    .select('id, name')
    .eq('name', 'B2B Sales Team')
    .maybeSingle()

  const orgId = typeof sp.org === 'string' ? sp.org : null
  const connected = typeof sp.connected === 'string' ? sp.connected : null
  const error = typeof sp.error === 'string' ? sp.error : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Get Your AI Sales Workforce Running</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          Three steps, no SQL, no configuration files — from a business name to a running campaign.
        </p>
      </div>

      {connected && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg px-4 py-3 text-sm">
          {connected === 'gmail' ? 'Gmail connected.' : `${connected} connected.`}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <OnboardingWizard initialOrgId={orgId} templateId={template?.id || null} templateName={template?.name || 'B2B Sales Team'} />
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deployTemplate } from '@/lib/templates'
import { getOrganizationIntegrations } from '@/lib/sales'
import { getCampaignState, CampaignState } from '@/lib/campaigns'
import { OrganizationIntegration } from '@/lib/types'
import IntegrationsPanel from '@/components/sales/IntegrationsPanel'
import CampaignLaunchForm from '@/components/campaigns/CampaignLaunchForm'

type OrgSummary = { id: string; name: string }

function StepShell({ number, title, done, locked, children }: { number: number; title: string; done: boolean; locked: boolean; children: React.ReactNode }) {
  return (
    <div className={`bg-[#0C0D22] border rounded-2xl p-6 ${done ? 'border-green-500/30' : locked ? 'border-[#3C3A58]/20 opacity-50' : 'border-[#3C3A58]/30'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-green-500/20 text-green-400' : 'bg-[#6D28D9]/20 text-[#6D28D9]'}`}>
          {done ? '✓' : number}
        </div>
        <h2 className="font-['Space_Grotesk'] font-bold text-lg">{title}</h2>
      </div>
      {!locked && children}
      {locked && <p className="text-sm text-[#8A88A8]">Complete the previous step first.</p>}
    </div>
  )
}

export default function OnboardingWizard({ initialOrgId, templateId, templateName }: { initialOrgId: string | null; templateId: string | null; templateName: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [org, setOrg] = useState<OrgSummary | null>(null)
  const [workforceDeployed, setWorkforceDeployed] = useState(false)
  const [integrations, setIntegrations] = useState<OrganizationIntegration[]>([])
  const [campaignState, setCampaignState] = useState<CampaignState | null>(null)
  const [loading, setLoading] = useState(!!initialOrgId)

  const [orgName, setOrgName] = useState('')
  const [industry, setIndustry] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)

  const refresh = useCallback(async (orgId: string) => {
    const [{ data: orgRow }, { data: goals }, integrationsList, campaign] = await Promise.all([
      supabase.from('organizations').select('id, name').eq('id', orgId).maybeSingle(),
      supabase.from('organization_goals').select('id').eq('organization_id', orgId).limit(1),
      getOrganizationIntegrations(supabase, orgId),
      getCampaignState(supabase, orgId),
    ])
    setOrg(orgRow ? { id: orgRow.id, name: orgRow.name } : null)
    setWorkforceDeployed(!!goals && goals.length > 0)
    setIntegrations(integrationsList)
    setCampaignState(campaign)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (initialOrgId) refresh(initialOrgId)
  }, [initialOrgId, refresh])

  async function deploy() {
    if (!orgName.trim() || !templateId) return
    setDeploying(true)
    setDeployError(null)
    const { organizationId, error } = await deployTemplate(supabase, templateId, orgName.trim(), industry.trim() || undefined)
    setDeploying(false)
    if (error || !organizationId) { setDeployError(error || 'Could not deploy workforce'); return }
    router.replace(`/onboarding?org=${organizationId}`)
    await refresh(organizationId)
  }

  const step1Done = !!org && workforceDeployed
  const anyIntegrationConnected = integrations.some((i) => i.status === 'connected')
  const step2Done = anyIntegrationConnected
  const step3Done = !!campaignState?.goal

  if (loading) return <p className="text-sm text-[#8A88A8]">Loading...</p>

  return (
    <div className="space-y-5">
      <StepShell number={1} title="Create Your Organization & Deploy Your Sales Workforce" done={step1Done} locked={false}>
        {step1Done ? (
          <p className="text-sm text-[#EDEAF8]">
            <span className="font-medium">{org!.name}</span> is set up with a full B2B Sales Team — Lead Research, Outreach, and CRM agents ready to go.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#8A88A8]">
              One step deploys a complete <span className="text-[#EDEAF8]">{templateName}</span> workforce — no agents to
              configure by hand.
            </p>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your business name"
              className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
            />
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Industry (optional)"
              className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
            />
            <button
              onClick={deploy}
              disabled={deploying || !orgName.trim() || !templateId}
              className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium"
            >
              {deploying ? 'Deploying...' : 'Create Organization & Deploy Workforce'}
            </button>
            {!templateId && <p className="text-xs text-red-400">The B2B Sales Team template isn&apos;t available on this deployment.</p>}
            {deployError && <p className="text-xs text-red-400">{deployError}</p>}
          </div>
        )}
      </StepShell>

      <StepShell number={2} title="Connect Your Integrations" done={step2Done} locked={!step1Done}>
        {org && (
          <>
            <p className="text-sm text-[#8A88A8] mb-3">
              Connect at least Gmail and Hunter.io to run a real campaign — HubSpot is optional but recommended for CRM tracking.
            </p>
            <IntegrationsPanel organizationId={org.id} integrations={integrations} isManager gmailReturnTo="onboarding" />
          </>
        )}
      </StepShell>

      <StepShell number={3} title="Launch Your First Campaign" done={step3Done} locked={!step1Done || !step2Done}>
        {org && !step3Done && <CampaignLaunchForm organizationId={org.id} />}
        {org && step3Done && (
          <div className="space-y-2">
            <p className="text-sm text-[#EDEAF8]">Your campaign is live.</p>
            <a href={`/organizations/${org.id}?tab=campaign`} className="inline-block bg-[#6D28D9] hover:bg-[#5B21B6] text-white px-4 py-2 rounded-lg text-sm font-medium">
              Go to Campaign Dashboard →
            </a>
          </div>
        )}
      </StepShell>
    </div>
  )
}

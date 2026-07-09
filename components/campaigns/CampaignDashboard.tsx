import Link from 'next/link'
import { CampaignState } from '@/lib/campaigns'
import { IntegrationProvider, OrganizationIntegration, OutreachDraft } from '@/lib/types'
import RunStageButton from './RunStageButton'
import ProspectsList from './ProspectsList'
import DraftsReview from './DraftsReview'
import CampaignControls from './CampaignControls'
import CheckRepliesButton from '@/components/sales/CheckRepliesButton'
import MarkMeetingBookedForm from '@/components/sales/MarkMeetingBookedForm'
import SalesMetricsPanel from '@/components/sales/SalesMetricsPanel'
import AvgDealValueForm from '@/components/sales/AvgDealValueForm'

type Lead = { name: string | null; email: string; title: string | null; company: string | null; domain: string }

const STAGE_PROVIDER: Record<'research' | 'outreach' | 'crm', { provider: IntegrationProvider; label: string }> = {
  research: { provider: 'hunter', label: 'Hunter.io' },
  outreach: { provider: 'gmail', label: 'Gmail' },
  crm: { provider: 'hubspot', label: 'HubSpot' },
}

function ConnectFirstNotice({ organizationId, label }: { organizationId: string; label: string }) {
  return (
    <p className="text-xs text-[#8A88A8]">
      Connect {label} to run this stage —{' '}
      <Link href={`/organizations/${organizationId}?tab=integrations`} className="text-[#6D28D9] hover:underline">
        go to Integrations
      </Link>
      .
    </p>
  )
}

function StageBadge({ label, tone }: { label: string; tone: 'pending' | 'ready' | 'done' | 'blocked' }) {
  const colors: Record<string, string> = {
    pending: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
    ready: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    done: 'text-green-400 bg-green-400/10 border-green-400/20',
    blocked: 'text-red-400 bg-red-400/10 border-red-400/20',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-md border ${colors[tone]}`}>{label}</span>
}

export default function CampaignDashboard({
  organizationId,
  state,
  integrations,
}: {
  organizationId: string
  state: CampaignState
  integrations: OrganizationIntegration[]
}) {
  const { goal, stages, metrics } = state
  if (!goal) return null

  const connected = new Set(integrations.filter((i) => i.status === 'connected').map((i) => i.provider))
  const isConnected = (stage: 'research' | 'outreach' | 'crm') => connected.has(STAGE_PROVIDER[stage].provider)

  const research = stages.find((s) => s.key === 'research')
  const outreach = stages.find((s) => s.key === 'outreach')
  const crm = stages.find((s) => s.key === 'crm')

  const leads = (research?.task?.output?.leads as Lead[]) || []
  const researchDone = leads.length > 0
  const drafts = (outreach?.task?.output?.drafts as OutreachDraft[]) || []
  const sent = (outreach?.task?.output?.sent as unknown[]) || []
  const synced = (crm?.task?.output?.synced as unknown[]) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-['Space_Grotesk'] font-bold text-lg">{goal.title}</h2>
          {goal.is_paused && goal.status !== 'failed' && <StageBadge label="Paused" tone="blocked" />}
        </div>
        <CampaignControls goalId={goal.id} isPaused={goal.is_paused} status={goal.status} />
      </div>

      <SalesMetricsPanel metrics={metrics} showPipelineValue />
      <AvgDealValueForm organizationId={organizationId} currentValue={metrics?.avg_deal_value ?? null} />

      {/* Stage 1: Research */}
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-[#EDEAF8]">1. Find & Enrich Prospects</h3>
          <StageBadge
            label={researchDone ? 'Done' : !isConnected('research') ? 'Needs Hunter.io' : research?.task ? 'Ready' : 'Not set up'}
            tone={researchDone ? 'done' : !isConnected('research') ? 'blocked' : research?.task ? 'ready' : 'pending'}
          />
        </div>
        {research?.agentName && <p className="text-xs text-[#8A88A8] mb-2">Run by {research.agentName}</p>}
        {!researchDone && research?.task && research.agentId && research.capabilityId && (
          isConnected('research') ? (
            <RunStageButton
              agentId={research.agentId}
              taskId={research.task.id}
              capabilityId={research.capabilityId}
              taskTitle={research.task.title}
              taskDescription={research.task.description}
              label="Find & Enrich Prospects"
            />
          ) : (
            <ConnectFirstNotice organizationId={organizationId} label={STAGE_PROVIDER.research.label} />
          )
        )}
        <ProspectsList leads={leads} />
      </div>

      {/* Stage 2: Outreach (draft -> human review -> send) */}
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-[#EDEAF8]">2. Draft & Send Outreach</h3>
          {(() => {
            let label: string, tone: 'pending' | 'ready' | 'done' | 'blocked'
            if (sent.length > 0) { label = 'Sent'; tone = 'done' }
            else if (drafts.length > 0) { label = 'Awaiting your approval'; tone = 'ready' }
            else if (!researchDone) { label = 'Waiting on prospects'; tone = 'pending' }
            else if (!isConnected('outreach')) { label = 'Needs Gmail'; tone = 'blocked' }
            else { label = 'Ready'; tone = 'ready' }
            return <StageBadge label={label} tone={tone} />
          })()}
        </div>
        {outreach?.agentName && <p className="text-xs text-[#8A88A8] mb-2">Run by {outreach.agentName}</p>}
        {researchDone && drafts.length === 0 && outreach?.task && outreach.agentId && outreach.capabilityId && (
          isConnected('outreach') ? (
            <RunStageButton
              agentId={outreach.agentId}
              taskId={outreach.task.id}
              capabilityId={outreach.capabilityId}
              taskTitle={outreach.task.title}
              taskDescription={outreach.task.description}
              label="Draft Outreach Emails"
            />
          ) : (
            <ConnectFirstNotice organizationId={organizationId} label={STAGE_PROVIDER.outreach.label} />
          )
        )}
        {!researchDone && <p className="text-xs text-[#8A88A8]">Complete prospect research first.</p>}
        {outreach?.task && outreach.agentId && (
          <DraftsReview
            organizationId={organizationId}
            agentId={outreach.agentId}
            taskId={outreach.task.id}
            drafts={drafts}
            alreadySent={sent.length > 0}
          />
        )}
      </div>

      {/* Stage 3: CRM */}
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-[#EDEAF8]">3. Sync to CRM</h3>
          <StageBadge
            label={synced.length > 0 ? 'Done' : !researchDone ? 'Waiting on prospects' : !isConnected('crm') ? 'Needs HubSpot' : 'Ready'}
            tone={synced.length > 0 ? 'done' : !researchDone ? 'pending' : !isConnected('crm') ? 'blocked' : 'ready'}
          />
        </div>
        {crm?.agentName && <p className="text-xs text-[#8A88A8] mb-2">Run by {crm.agentName}</p>}
        {researchDone && synced.length === 0 && crm?.task && crm.agentId && crm.capabilityId && (
          isConnected('crm') ? (
            <RunStageButton
              agentId={crm.agentId}
              taskId={crm.task.id}
              capabilityId={crm.capabilityId}
              taskTitle={crm.task.title}
              taskDescription={crm.task.description}
              label="Sync to CRM"
            />
          ) : (
            <ConnectFirstNotice organizationId={organizationId} label={STAGE_PROVIDER.crm.label} />
          )
        )}
        {synced.length > 0 && <p className="text-xs text-[#8A88A8]">{synced.length} contact(s) synced to HubSpot.</p>}
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-[#EDEAF8]">Track Replies & Meetings</h3>
        <CheckRepliesButton organizationId={organizationId} />
        <MarkMeetingBookedForm organizationId={organizationId} />
      </div>
    </div>
  )
}

import { CampaignState } from '@/lib/campaigns'
import { OutreachDraft } from '@/lib/types'
import RunStageButton from './RunStageButton'
import ProspectsList from './ProspectsList'
import DraftsReview from './DraftsReview'
import CampaignControls from './CampaignControls'
import CheckRepliesButton from '@/components/sales/CheckRepliesButton'
import MarkMeetingBookedForm from '@/components/sales/MarkMeetingBookedForm'
import SalesMetricsPanel from '@/components/sales/SalesMetricsPanel'
import AvgDealValueForm from '@/components/sales/AvgDealValueForm'

type Lead = { name: string | null; email: string; title: string | null; company: string | null; domain: string }

function StageBadge({ label, tone }: { label: string; tone: 'pending' | 'ready' | 'done' | 'blocked' }) {
  const colors: Record<string, string> = {
    pending: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
    ready: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    done: 'text-green-400 bg-green-400/10 border-green-400/20',
    blocked: 'text-red-400 bg-red-400/10 border-red-400/20',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-md border ${colors[tone]}`}>{label}</span>
}

export default function CampaignDashboard({ organizationId, state }: { organizationId: string; state: CampaignState }) {
  const { goal, stages, metrics } = state
  if (!goal) return null

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
          <StageBadge label={researchDone ? 'Done' : research?.task ? 'Ready' : 'Not set up'} tone={researchDone ? 'done' : research?.task ? 'ready' : 'pending'} />
        </div>
        {research?.agentName && <p className="text-xs text-[#8A88A8] mb-2">Run by {research.agentName}</p>}
        {!researchDone && research?.task && research.agentId && research.capabilityId && (
          <RunStageButton
            agentId={research.agentId}
            taskId={research.task.id}
            capabilityId={research.capabilityId}
            taskTitle={research.task.title}
            taskDescription={research.task.description}
            label="Find & Enrich Prospects"
          />
        )}
        <ProspectsList leads={leads} />
      </div>

      {/* Stage 2: Outreach (draft -> human review -> send) */}
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-[#EDEAF8]">2. Draft & Send Outreach</h3>
          <StageBadge
            label={sent.length > 0 ? 'Sent' : drafts.length > 0 ? 'Awaiting your approval' : researchDone ? 'Ready' : 'Waiting on prospects'}
            tone={sent.length > 0 ? 'done' : drafts.length > 0 ? 'ready' : researchDone ? 'ready' : 'pending'}
          />
        </div>
        {outreach?.agentName && <p className="text-xs text-[#8A88A8] mb-2">Run by {outreach.agentName}</p>}
        {researchDone && drafts.length === 0 && outreach?.task && outreach.agentId && outreach.capabilityId && (
          <RunStageButton
            agentId={outreach.agentId}
            taskId={outreach.task.id}
            capabilityId={outreach.capabilityId}
            taskTitle={outreach.task.title}
            taskDescription={outreach.task.description}
            label="Draft Outreach Emails"
          />
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
            label={synced.length > 0 ? 'Done' : researchDone ? 'Ready' : 'Waiting on prospects'}
            tone={synced.length > 0 ? 'done' : researchDone ? 'ready' : 'pending'}
          />
        </div>
        {crm?.agentName && <p className="text-xs text-[#8A88A8] mb-2">Run by {crm.agentName}</p>}
        {researchDone && synced.length === 0 && crm?.task && crm.agentId && crm.capabilityId && (
          <RunStageButton
            agentId={crm.agentId}
            taskId={crm.task.id}
            capabilityId={crm.capabilityId}
            taskTitle={crm.task.title}
            taskDescription={crm.task.description}
            label="Sync to CRM"
          />
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

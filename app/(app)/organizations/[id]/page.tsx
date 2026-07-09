import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  AgentAssignment, Organization, OrganizationActivity, OrganizationDepartment,
  OrganizationMember, OrganizationMetrics, Task, Workflow, WorkflowRun,
} from '@/lib/types'
import { getInitials, getTrustScoreColor, formatTimeAgo } from '@/lib/utils'
import OrgTabs from '@/components/organizations/OrgTabs'
import DepartmentsPanel from '@/components/organizations/DepartmentsPanel'
import AgentAssignmentsPanel from '@/components/organizations/AgentAssignmentsPanel'
import OrgPerformancePanel from '@/components/organizations/OrgPerformancePanel'
import OrgActivityFeed from '@/components/organizations/OrgActivityFeed'
import CreateWorkflowForm from '@/components/organizations/CreateWorkflowForm'
import WorkflowCard from '@/components/organizations/WorkflowCard'
import WorkflowRunsList from '@/components/organizations/WorkflowRunsList'
import TaskDashboardPanel from '@/components/organizations/TaskDashboardPanel'
import IntegrationsPanel from '@/components/sales/IntegrationsPanel'
import SalesMetricsPanel from '@/components/sales/SalesMetricsPanel'
import SalesActivityFeed from '@/components/sales/SalesActivityFeed'
import CheckRepliesButton from '@/components/sales/CheckRepliesButton'
import MarkMeetingBookedForm from '@/components/sales/MarkMeetingBookedForm'
import { getOrganizationIntegrations, getSalesActivity, getSalesMetrics } from '@/lib/sales'
import SetupWizardPanel from '@/components/sales/SetupWizardPanel'
import { getSetupWizardState } from '@/lib/setupWizard'
import CampaignDashboard from '@/components/campaigns/CampaignDashboard'
import CampaignLaunchForm from '@/components/campaigns/CampaignLaunchForm'
import { getCampaignState } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'

const VALID_TABS = ['overview', 'departments', 'agents', 'performance', 'tasks', 'workflows', 'activity', 'sales', 'integrations', 'setup', 'campaign'] as const
type Tab = (typeof VALID_TABS)[number]

export default async function OrganizationPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab
  const tab: Tab = (VALID_TABS as readonly string[]).includes(tabParam || '') ? (tabParam as Tab) : 'overview'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('*, profiles!organizations_owner_id_fkey(*), organization_metrics(*)')
    .eq('id', id)
    .maybeSingle()

  if (!org) notFound()

  const { data: isManager } = await supabase.rpc('is_org_manager', { p_org_id: id, p_user_id: user.id })
  const metrics = (Array.isArray(org.organization_metrics) ? org.organization_metrics[0] : org.organization_metrics) as OrganizationMetrics | null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-3">
          {org.avatar_url ? (
            <Image src={org.avatar_url} alt="" width={48} height={48} className="rounded-xl object-cover w-12 h-12" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#6D28D9] flex items-center justify-center font-semibold text-white text-lg">
              {getInitials(org.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-['Space_Grotesk'] text-xl font-bold text-[#EDEAF8]">{org.name}</h1>
              {org.industry && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">{org.industry}</span>
              )}
            </div>
            <div className="text-xs text-[#8A88A8] mt-0.5">
              Owned by {org.profiles?.full_name || 'Unknown'} · created {formatTimeAgo(org.created_at)}
              {org.website_url && (
                <> · <a href={org.website_url} target="_blank" rel="noopener noreferrer" className="text-[#8B5CF6] hover:underline">{org.website_url}</a></>
              )}
            </div>
          </div>
        </div>
        {org.description && <p className="text-[#EDEAF8] text-sm leading-relaxed">{org.description}</p>}
      </div>

      <OrgTabs orgId={id} active={tab} />

      {tab === 'overview' && <OverviewTab organizationId={id} metrics={metrics} />}
      {tab === 'departments' && <DepartmentsTab organizationId={id} isManager={!!isManager} />}
      {tab === 'agents' && <AgentsTab organizationId={id} currentUserId={user.id} isManager={!!isManager} />}
      {tab === 'performance' && <PerformanceTab organizationId={id} metrics={metrics} />}
      {tab === 'tasks' && <TasksTab organizationId={id} />}
      {tab === 'workflows' && <WorkflowsTab organizationId={id} currentUserId={user.id} isManager={!!isManager} />}
      {tab === 'activity' && <ActivityTab organizationId={id} />}
      {tab === 'sales' && <SalesTab organizationId={id} />}
      {tab === 'integrations' && <IntegrationsTab organizationId={id} isManager={!!isManager} error={Array.isArray(sp.error) ? sp.error[0] : sp.error} />}
      {tab === 'setup' && <SetupWizardTab organizationId={id} />}
      {tab === 'campaign' && <CampaignTab organizationId={id} />}
    </div>
  )
}

async function OverviewTab({ organizationId, metrics }: { organizationId: string; metrics: OrganizationMetrics | null }) {
  const supabase = await createClient()
  const [{ count: memberCount }, { count: departmentCount }, { data: members }, { data: recentActivity }] = await Promise.all([
    supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('organization_departments').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('organization_members').select('*, profiles(*), organization_roles(*)').eq('organization_id', organizationId).order('created_at', { ascending: true }).limit(6),
    supabase.from('organization_activity').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href={`/goals?org_id=${organizationId}`} className="text-sm text-[#8B5CF6] hover:text-[#6D28D9]">
          🎯 View Goals →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Members" value={memberCount || 0} />
        <Stat label="Departments" value={departmentCount || 0} />
        <Stat label="Agents" value={metrics?.total_agents ?? 0} />
        <Stat label="Trust Score" value={metrics ? metrics.trust_score.toFixed(0) : '0'} valueClass={metrics ? getTrustScoreColor(metrics.trust_score) : ''} />
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Team</h2>
        <div className="space-y-2">
          {((members as OrganizationMember[]) || []).map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#6D28D9] flex items-center justify-center text-xs font-semibold text-white shrink-0">
                {getInitials(m.profiles?.full_name || null)}
              </div>
              <span className="text-sm text-[#EDEAF8] flex-1">{m.profiles?.full_name || 'Unknown'}</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                {m.organization_roles?.name || 'Member'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Recent Activity</h2>
        <OrgActivityFeed activity={(recentActivity as OrganizationActivity[]) || []} />
      </div>
    </div>
  )
}

function Stat({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <div className="text-xs text-[#8A88A8] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valueClass || 'text-[#EDEAF8]'}`}>{value}</div>
    </div>
  )
}

async function DepartmentsTab({ organizationId, isManager }: { organizationId: string; isManager: boolean }) {
  const supabase = await createClient()
  const [{ data: departments }, { data: activeAssignments }] = await Promise.all([
    supabase.from('organization_departments').select('*').eq('organization_id', organizationId).order('is_custom').order('name'),
    supabase.from('agent_assignments').select('department_id').eq('organization_id', organizationId).eq('status', 'active'),
  ])

  const agentCounts: Record<string, number> = {}
  for (const row of activeAssignments || []) {
    if (row.department_id) agentCounts[row.department_id] = (agentCounts[row.department_id] || 0) + 1
  }

  return (
    <DepartmentsPanel
      organizationId={organizationId}
      departments={(departments as OrganizationDepartment[]) || []}
      agentCounts={agentCounts}
      isManager={isManager}
    />
  )
}

async function AgentsTab({ organizationId, currentUserId, isManager }: { organizationId: string; currentUserId: string; isManager: boolean }) {
  const supabase = await createClient()
  const [{ data: assignments }, { data: departments }, { data: myAgents }] = await Promise.all([
    supabase
      .from('agent_assignments')
      .select('*, agents(id, name, avatar_url, status, trust_score, owner_id), organization_departments(*)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
    supabase.from('organization_departments').select('*').eq('organization_id', organizationId).order('name'),
    supabase.from('agents').select('id, name').eq('owner_id', currentUserId).order('name'),
  ])

  return (
    <AgentAssignmentsPanel
      organizationId={organizationId}
      assignments={(assignments as AgentAssignment[]) || []}
      departments={(departments as OrganizationDepartment[]) || []}
      myAgents={myAgents || []}
      isManager={isManager}
      currentUserId={currentUserId}
    />
  )
}

async function PerformanceTab({ organizationId, metrics }: { organizationId: string; metrics: OrganizationMetrics | null }) {
  const supabase = await createClient()
  const [{ data: departments }, { data: activeAssignments }] = await Promise.all([
    supabase.from('organization_departments').select('id, name').eq('organization_id', organizationId),
    supabase.from('agent_assignments').select('department_id').eq('organization_id', organizationId).eq('status', 'active'),
  ])

  const countsByDept: Record<string, number> = {}
  for (const row of activeAssignments || []) {
    if (row.department_id) countsByDept[row.department_id] = (countsByDept[row.department_id] || 0) + 1
  }
  const departmentBreakdown = ((departments || []) as { id: string; name: string }[])
    .map((d) => ({ department_name: d.name, agent_count: countsByDept[d.id] || 0 }))
    .filter((d) => d.agent_count > 0)
    .sort((a, b) => b.agent_count - a.agent_count)

  return <OrgPerformancePanel metrics={metrics} departmentBreakdown={departmentBreakdown} />
}

async function WorkflowsTab({ organizationId, currentUserId, isManager }: { organizationId: string; currentUserId: string; isManager: boolean }) {
  const supabase = await createClient()
  const [{ data: workflows }, { data: departments }, { data: assignedAgents }, { data: runs }] = await Promise.all([
    supabase.from('workflows').select('*, workflow_steps(*)').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    supabase.from('organization_departments').select('*').eq('organization_id', organizationId).order('name'),
    supabase.from('agent_assignments').select('agents(id, name)').eq('organization_id', organizationId).eq('status', 'active'),
    supabase.from('workflow_runs').select('*, workflows(id, name)').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(20),
  ])

  const orgAgents = Array.from(
    new Map(((assignedAgents || []) as unknown as { agents: { id: string; name: string } | null }[])
      .filter((r) => r.agents)
      .map((r) => [r.agents!.id, r.agents!])
    ).values()
  )

  const stepNameByWorkflowAndOrder = new Map<string, string>()
  for (const wf of (workflows as Workflow[]) || []) {
    for (const step of wf.workflow_steps || []) {
      stepNameByWorkflowAndOrder.set(`${wf.id}:${step.step_order}`, step.name)
    }
  }
  const runsWithStepName = ((runs as WorkflowRun[]) || []).map((r) => ({
    ...r,
    current_step_name: stepNameByWorkflowAndOrder.get(`${r.workflow_id}:${r.current_step_order}`) || null,
  }))

  return (
    <div className="space-y-6">
      {isManager && <CreateWorkflowForm organizationId={organizationId} currentUserId={currentUserId} />}

      {((workflows as Workflow[]) || []).length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10">No workflows yet.</div>
      ) : (
        <div className="space-y-4">
          {(workflows as Workflow[]).map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              departments={(departments as OrganizationDepartment[]) || []}
              orgAgents={orgAgents}
              isManager={isManager}
            />
          ))}
        </div>
      )}

      <WorkflowRunsList runs={runsWithStepName} isManager={isManager} />
    </div>
  )
}

async function TasksTab({ organizationId }: { organizationId: string }) {
  const supabase = await createClient()

  const [{ count: tasksCompleted }, { count: tasksFailed }, { data: completedTasks }, { data: recentTasks }] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'completed'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'failed'),
    supabase
      .from('tasks')
      .select('execution_time_seconds, agents(name), organization_departments(name)')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .limit(2000),
    supabase
      .from('tasks')
      .select('*, organizations(id, name), organization_departments(id, name), agents(id, name, avatar_url, owner_id)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const rows = (completedTasks || []) as unknown as {
    execution_time_seconds: number | null
    agents: { name: string } | null
    organization_departments: { name: string } | null
  }[]

  const durations = rows.map((r) => r.execution_time_seconds).filter((v): v is number => v != null)
  const avgCompletionSeconds = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null

  const agentCounts = new Map<string, number>()
  const deptCounts = new Map<string, number>()
  for (const r of rows) {
    if (r.agents?.name) agentCounts.set(r.agents.name, (agentCounts.get(r.agents.name) || 0) + 1)
    if (r.organization_departments?.name) deptCounts.set(r.organization_departments.name, (deptCounts.get(r.organization_departments.name) || 0) + 1)
  }
  const topAgents = Array.from(agentCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  const topDepartments = Array.from(deptCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)

  return (
    <TaskDashboardPanel
      organizationId={organizationId}
      tasksCompleted={tasksCompleted || 0}
      tasksFailed={tasksFailed || 0}
      avgCompletionSeconds={avgCompletionSeconds}
      topAgents={topAgents}
      topDepartments={topDepartments}
      recentTasks={(recentTasks as Task[]) || []}
    />
  )
}

async function ActivityTab({ organizationId }: { organizationId: string }) {
  const supabase = await createClient()
  const { data: activity } = await supabase
    .from('organization_activity')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(50)

  return <OrgActivityFeed activity={(activity as OrganizationActivity[]) || []} />
}

async function SalesTab({ organizationId }: { organizationId: string }) {
  const supabase = await createClient()
  const [metrics, activity] = await Promise.all([
    getSalesMetrics(supabase, organizationId),
    getSalesActivity(supabase, organizationId, 50),
  ])

  return (
    <div className="space-y-6">
      <SalesMetricsPanel metrics={metrics} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg">Activity</h2>
        <CheckRepliesButton organizationId={organizationId} />
      </div>
      <SalesActivityFeed activity={activity} />
      <MarkMeetingBookedForm organizationId={organizationId} />
    </div>
  )
}

async function IntegrationsTab({ organizationId, isManager, error }: { organizationId: string; isManager: boolean; error?: string }) {
  const supabase = await createClient()
  const integrations = await getOrganizationIntegrations(supabase, organizationId)

  return <IntegrationsPanel organizationId={organizationId} integrations={integrations} isManager={isManager} error={error} />
}

async function SetupWizardTab({ organizationId }: { organizationId: string }) {
  const supabase = await createClient()
  const state = await getSetupWizardState(supabase, organizationId)

  return <SetupWizardPanel state={state} />
}

async function CampaignTab({ organizationId }: { organizationId: string }) {
  const supabase = await createClient()
  const [state, integrations] = await Promise.all([
    getCampaignState(supabase, organizationId),
    getOrganizationIntegrations(supabase, organizationId),
  ])

  // A goal can exist with no usable campaign behind it yet — e.g. launch
  // partially failed (goal created, plan/approval step didn't finish) or
  // this is a "Generate Leads" goal from somewhere other than the guided
  // launch flow. Gate on there being at least one real task, not just a
  // goal row, so a partial failure doesn't strand the user on a
  // permanently empty dashboard with no way to (re)launch.
  const hasCampaign = !!state.goal && state.stages.some((s) => s.task)

  return hasCampaign ? (
    <CampaignDashboard organizationId={organizationId} state={state} integrations={integrations} />
  ) : (
    <CampaignLaunchForm organizationId={organizationId} />
  )
}

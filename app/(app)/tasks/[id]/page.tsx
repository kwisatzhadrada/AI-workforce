import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AgentCapability, AgentExecution, Delegation, Task, TaskHistoryEvent, TaskReview } from '@/lib/types'
import { getAssignmentPriorityColor, getTaskStatusColor, getInitials, getTrustScoreColor, formatTimeAgo, formatDuration } from '@/lib/utils'
import TaskActions from '@/components/tasks/TaskActions'
import TaskReviewForm from '@/components/tasks/TaskReviewForm'
import TaskHistoryTimeline from '@/components/tasks/TaskHistoryTimeline'
import AssignAgentControl from '@/components/tasks/AssignAgentControl'
import ExecutionPanel from '@/components/tasks/ExecutionPanel'
import DelegationPanel from '@/components/tasks/DelegationPanel'

export const dynamic = 'force-dynamic'

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: task } = await supabase
    .from('tasks')
    .select('*, organizations(id, name), organization_departments(id, name), agents(id, name, avatar_url, owner_id, trust_score), task_reviews(*, profiles(*))')
    .eq('id', id)
    .maybeSingle()

  if (!task) notFound()

  const [{ data: isSupervisor }, { data: history }, { data: assignableAgents }, { data: myAgentIds }] = await Promise.all([
    supabase.rpc('is_org_supervisor', { p_org_id: task.organization_id, p_user_id: user.id }),
    supabase.from('task_history').select('*').eq('task_id', id).order('created_at', { ascending: true }),
    supabase.from('agent_assignments').select('agents(id, name)').eq('organization_id', task.organization_id).eq('status', 'active'),
    supabase.from('agents').select('id').eq('owner_id', user.id),
  ])

  const isAssignedAgentOwner = task.agents?.owner_id === user.id
  const canExecute = !!isSupervisor || isAssignedAgentOwner
  const review = (task.task_reviews as TaskReview[] | undefined)?.[0]

  const agentOptions = Array.from(
    new Map(((assignableAgents || []) as unknown as { agents: { id: string; name: string } | null }[])
      .filter((r) => r.agents)
      .map((r) => [r.agents!.id, r.agents!])
    ).values()
  )

  const myOwnedAgentIds = (myAgentIds || []).map((a) => a.id)

  // Delegations are always fetched (RLS scopes visibility to the from/to
  // agent owners and org members) since the delegation *target's* owner
  // needs to see and respond to it even though they don't yet own the task's
  // assigned agent.
  const [{ data: delegations }, capabilitiesResult, executionsResult] = await Promise.all([
    supabase
      .from('delegations')
      .select('*, from_agent:agents!delegations_from_agent_id_fkey(id, name), to_agent:agents!delegations_to_agent_id_fkey(id, name)')
      .eq('task_id', id)
      .order('created_at', { ascending: false }),
    task.agents && isAssignedAgentOwner
      ? supabase.from('agent_capabilities').select('*').eq('agent_id', task.agents.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
    task.agents && isAssignedAgentOwner
      ? supabase.from('agent_executions').select('*, agent_capabilities(id, name)').eq('task_id', id).order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: null }),
  ])
  const capabilities = capabilitiesResult.data
  const executions = executionsResult.data

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="font-['Space_Grotesk'] text-xl font-bold text-[#EDEAF8]">{task.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-md border ${getAssignmentPriorityColor(task.priority)}`}>{task.priority}</span>
            <span className={`text-xs px-2 py-0.5 rounded-md border ${getTaskStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</span>
          </div>
        </div>

        <div className="text-xs text-[#8A88A8] mb-3 flex flex-wrap gap-x-2">
          {task.organizations && (
            <Link href={`/organizations/${task.organizations.id}`} className="hover:underline">{task.organizations.name}</Link>
          )}
          {task.organization_departments && <span>· {task.organization_departments.name}</span>}
          <span>· created {formatTimeAgo(task.created_at)}</span>
          {task.due_date && <span>· due {formatTimeAgo(task.due_date)}</span>}
        </div>

        {task.description && <p className="text-[#EDEAF8] text-sm leading-relaxed mb-4">{task.description}</p>}

        <div className="flex items-center gap-3">
          {task.agents ? (
            <Link href={`/agent/${task.agents.id}`} className="flex items-center gap-2 bg-[#121428] border border-[#3C3A58] rounded-lg px-3 py-1.5 hover:border-[#6D28D9]">
              <span className="w-6 h-6 rounded-full bg-[#6D28D9] flex items-center justify-center text-xs font-semibold text-white">{getInitials(task.agents.name)}</span>
              <span className="text-sm text-[#EDEAF8]">{task.agents.name}</span>
              <span className={`text-xs ${getTrustScoreColor(task.agents.trust_score)}`}>Trust {task.agents.trust_score.toFixed(0)}</span>
            </Link>
          ) : isSupervisor ? (
            <AssignAgentControl taskId={task.id} agentOptions={agentOptions} />
          ) : (
            <span className="text-sm text-[#8A88A8]">Unassigned</span>
          )}
        </div>
      </div>

      {(task.started_at || task.completed_at) && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Execution</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#121428] rounded-xl p-3">
              <div className="text-xs text-[#8A88A8] mb-1">Started</div>
              <div className="text-sm font-medium text-[#EDEAF8]">{task.started_at ? formatTimeAgo(task.started_at) : '—'}</div>
            </div>
            <div className="bg-[#121428] rounded-xl p-3">
              <div className="text-xs text-[#8A88A8] mb-1">Completed</div>
              <div className="text-sm font-medium text-[#EDEAF8]">{task.completed_at ? formatTimeAgo(task.completed_at) : '—'}</div>
            </div>
            <div className="bg-[#121428] rounded-xl p-3">
              <div className="text-xs text-[#8A88A8] mb-1">Duration</div>
              <div className="text-sm font-medium text-[#EDEAF8]">{formatDuration(task.execution_time_seconds)}</div>
            </div>
          </div>
        </div>
      )}

      {(task.result_summary || task.attachments.length > 0) && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Output</h2>
          {task.result_summary && <p className="text-sm text-[#EDEAF8] mb-3">{task.result_summary}</p>}
          {task.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {task.attachments.map((link: string) => (
                <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#8B5CF6] hover:underline">{link}</a>
              ))}
            </div>
          )}
        </div>
      )}

      <TaskActions task={task as Task} canExecute={canExecute} />

      {task.agents && isAssignedAgentOwner && task.status !== 'completed' && task.status !== 'failed' && (
        <ExecutionPanel
          taskId={task.id}
          agentId={task.agents.id}
          taskTitle={task.title}
          taskDescription={task.description}
          capabilities={(capabilities as AgentCapability[]) || []}
          executions={(executions as AgentExecution[]) || []}
        />
      )}

      {task.agents && (isAssignedAgentOwner || isSupervisor) && task.status !== 'completed' && task.status !== 'failed' && (
        <DelegationPanel
          taskId={task.id}
          fromAgentId={task.agents.id}
          delegationTargets={agentOptions}
          delegations={(delegations as Delegation[]) || []}
          currentUserOwnedAgentIds={myOwnedAgentIds}
        />
      )}

      {task.status === 'review' && isSupervisor && !review && (
        <TaskReviewForm taskId={task.id} reviewerId={user.id} />
      )}

      {review && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Review</h2>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-yellow-400 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            {review.quality_score != null && <span className="text-xs text-[#8A88A8]">Quality {review.quality_score}</span>}
            {review.speed_score != null && <span className="text-xs text-[#8A88A8]">Speed {review.speed_score}</span>}
          </div>
          {review.feedback && <p className="text-sm text-[#EDEAF8]">{review.feedback}</p>}
          <div className="text-xs text-[#8A88A8] mt-2">by {review.profiles?.full_name || 'Reviewer'} · {formatTimeAgo(review.created_at)}</div>
        </div>
      )}

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">History</h2>
        <TaskHistoryTimeline events={(history as TaskHistoryEvent[]) || []} />
      </div>
    </div>
  )
}

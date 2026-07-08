import Link from 'next/link'
import {
  IdleAgent,
  OverloadedAgent,
  StuckGoal,
  TaskAssignmentFailure,
  TrustScoreAnomaly,
  WorkflowDeadlock,
} from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

type Bottlenecks = {
  overloadedAgents: OverloadedAgent[]
  idleAgents: IdleAgent[]
  workflowDeadlocks: WorkflowDeadlock[]
  stuckGoals: StuckGoal[]
  taskAssignmentFailures: TaskAssignmentFailure[]
  trustScoreAnomalies: TrustScoreAnomaly[]
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#EDEAF8]">{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">{count}</span>
      </div>
      {count === 0 ? <div className="text-xs text-[#8A88A8]">None detected.</div> : <div className="space-y-1.5">{children}</div>}
    </div>
  )
}

export default function BottlenecksPanel({ data }: { data: Bottlenecks }) {
  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Bottleneck Analysis</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <Section title="Overloaded Agents" count={data.overloadedAgents.length}>
          {data.overloadedAgents.map((a) => (
            <Link key={a.agent_id} href={`/agent/${a.agent_id}`} className="flex justify-between text-xs hover:underline">
              <span className="text-[#EDEAF8]">{a.agent_name}</span>
              <span className="text-[#8A88A8]">{a.live_task_count} active</span>
            </Link>
          ))}
        </Section>

        <Section title="Idle Agents" count={data.idleAgents.length}>
          {data.idleAgents.map((a) => (
            <Link key={a.agent_id} href={`/agent/${a.agent_id}`} className="flex justify-between text-xs hover:underline">
              <span className="text-[#EDEAF8]">{a.agent_name}</span>
              <span className="text-[#8A88A8]">{a.last_active_at ? formatTimeAgo(a.last_active_at) : 'never active'}</span>
            </Link>
          ))}
        </Section>

        <Section title="Workflow Deadlocks" count={data.workflowDeadlocks.length}>
          {data.workflowDeadlocks.map((w) => (
            <Link key={w.workflow_run_id} href={`/organizations/${w.organization_id}`} className="flex justify-between text-xs hover:underline">
              <span className="text-[#EDEAF8]">Step {w.current_step_order}</span>
              <span className="text-[#8A88A8]">{w.stalled_since ? formatTimeAgo(w.stalled_since) : ''}</span>
            </Link>
          ))}
        </Section>

        <Section title="Stuck Goals" count={data.stuckGoals.length}>
          {data.stuckGoals.map((g) => (
            <Link key={g.goal_id} href={`/goals/${g.goal_id}`} className="flex justify-between text-xs hover:underline">
              <span className="text-[#EDEAF8]">{g.title}</span>
              <span className="text-[#8A88A8]">{g.is_paused ? 'paused' : formatTimeAgo(g.updated_at)}</span>
            </Link>
          ))}
        </Section>

        <Section title="Task Assignment Failures" count={data.taskAssignmentFailures.length}>
          {data.taskAssignmentFailures.map((t) => (
            <Link key={t.task_id} href={`/tasks/${t.task_id}`} className="flex justify-between text-xs hover:underline">
              <span className="text-[#EDEAF8]">{t.title}</span>
              <span className="text-[#8A88A8]">{formatTimeAgo(t.created_at)}</span>
            </Link>
          ))}
        </Section>

        <Section title="Trust Score Anomalies" count={data.trustScoreAnomalies.length}>
          {data.trustScoreAnomalies.map((a) => (
            <Link key={a.agent_id} href={`/agent/${a.agent_id}`} className="flex justify-between text-xs hover:underline">
              <span className="text-[#EDEAF8]">{a.agent_name}</span>
              <span className="text-[#8A88A8]">{a.recent_failures} recent failures at trust {a.trust_score}</span>
            </Link>
          ))}
        </Section>
      </div>
    </div>
  )
}

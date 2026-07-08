import { AnomalyReport } from '@/lib/types'

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

export default function AnomaliesPanel({ data }: { data: AnomalyReport | null }) {
  if (!data) return null

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Section title="Unusual Failures" count={data.unusual_failures.length}>
        {data.unusual_failures.map((f) => (
          <div key={f.agent_id} className="flex justify-between text-xs">
            <span className="text-[#EDEAF8]">{f.agent_name}</span>
            <span className="text-[#8A88A8]">{f.recent_failure_rate.toFixed(0)}% vs {f.historical_failure_rate.toFixed(0)}% baseline</span>
          </div>
        ))}
      </Section>

      <Section title="Trust Score Anomalies" count={data.trust_score_anomalies.length}>
        {data.trust_score_anomalies.map((a) => (
          <div key={a.agent_id} className="flex justify-between text-xs">
            <span className="text-[#EDEAF8]">{a.agent_name}</span>
            <span className="text-[#8A88A8]">{a.recent_failures} recent failures at trust {a.trust_score}</span>
          </div>
        ))}
      </Section>

      <Section title="Delegation Loops" count={data.delegation_loops.length}>
        {data.delegation_loops.map((d) => (
          <div key={d.task_id} className="flex justify-between text-xs">
            <span className="text-[#EDEAF8]">Task {d.task_id.slice(0, 8)}…</span>
            <span className="text-[#8A88A8]">{d.delegation_count} delegations, {d.agents_involved.length} agents</span>
          </div>
        ))}
      </Section>

      <Section title="Workflow Deadlocks" count={data.workflow_deadlocks.length}>
        {data.workflow_deadlocks.map((w) => (
          <div key={w.workflow_run_id} className="flex justify-between text-xs">
            <span className="text-[#EDEAF8]">Step {w.current_step_order}</span>
            <span className="text-[#8A88A8]">stalled</span>
          </div>
        ))}
      </Section>

      <Section title="Underperforming Organizations" count={data.underperforming_organizations.length}>
        {data.underperforming_organizations.map((o) => (
          <div key={o.organization_id} className="flex justify-between text-xs">
            <span className="text-[#EDEAF8]">{o.name}</span>
            <span className="text-[#8A88A8]">{o.health_score.toFixed(0)} vs {o.platform_avg.toFixed(0)} avg</span>
          </div>
        ))}
      </Section>
    </div>
  )
}

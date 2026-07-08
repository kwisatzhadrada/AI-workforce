import Link from 'next/link'
import { AssignmentDecisionRow } from '@/lib/types'
import { formatTimeAgo, getDecisionOutcomeColor } from '@/lib/utils'

export default function AssignmentDecisionsPanel({ rows }: { rows: AssignmentDecisionRow[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Assignment Decisions</h2>
      <p className="text-xs text-[#8A88A8] mb-2">Why each agent was — or wasn&apos;t — chosen for a task.</p>
      {rows.length === 0 ? (
        <div className="text-xs text-[#8A88A8]">No assignment decisions yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const matchType = typeof r.outputs.match_type === 'string' ? r.outputs.match_type : null
            return (
              <div key={r.id} className="text-xs py-1.5 border-b border-[#3C3A58]/20 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {r.task_title ? (
                      <Link href={`/tasks/${r.task_id}`} className="text-[#EDEAF8] hover:underline">
                        {r.task_title}
                      </Link>
                    ) : (
                      <span className="text-[#EDEAF8]">(task deleted)</span>
                    )}
                    {r.assigned_agent_name && (
                      <span className="text-[#8A88A8]">
                        {' '}
                        →{' '}
                        <Link href={`/agent/${r.assigned_agent_id}`} className="hover:underline">
                          {r.assigned_agent_name}
                        </Link>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {matchType && (
                      <span className="px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                        {matchType === 'capability_match' ? 'capability match' : 'fallback'}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-md border ${getDecisionOutcomeColor(r.outcome)}`}>{r.outcome}</span>
                    <span className="text-[#8A88A8]">{formatTimeAgo(r.created_at)}</span>
                  </div>
                </div>
                <div className="text-[#8A88A8] mt-0.5">{r.reasoning}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

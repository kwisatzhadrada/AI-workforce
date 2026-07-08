import Link from 'next/link'
import { ExecutionHistoryRow } from '@/lib/types'
import { formatTimeAgo, getExecutionStatusColor } from '@/lib/utils'

export default function ExecutionHistoryPanel({ rows }: { rows: ExecutionHistoryRow[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Execution History</h2>
      {rows.length === 0 ? (
        <div className="text-xs text-[#8A88A8]">No executions yet.</div>
      ) : (
        <div className="space-y-1.5 overflow-x-auto">
          {rows.map((r) => (
            <div key={r.execution_id} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-[#3C3A58]/20 last:border-0">
              <div className="min-w-0">
                <Link href={`/executions/${r.execution_id}`} className="text-[#EDEAF8] hover:underline">
                  {r.agent_name}
                </Link>
                <span className="text-[#8A88A8]"> — {r.capability_name || 'no capability'}{r.integration_action ? ` (${r.integration_action})` : ''}</span>
                {r.task_title && (
                  <div className="text-[#8A88A8] truncate">
                    on{' '}
                    <Link href={`/tasks/${r.task_id}`} className="hover:underline">
                      {r.task_title}
                    </Link>
                  </div>
                )}
                {r.error && <div className="text-red-400/80 truncate">{r.error}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-md border ${getExecutionStatusColor(r.status)}`}>{r.status}</span>
                <span className="text-[#8A88A8]">{formatTimeAgo(r.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import Link from 'next/link'
import { ExecutionFailureRow } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

export default function ExecutionFailuresPanel({ rows }: { rows: ExecutionFailureRow[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Recent Failures</h2>
      {rows.length === 0 ? (
        <div className="text-xs text-[#8A88A8]">No failures recorded.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.execution_id} className="text-xs py-1 border-b border-[#3C3A58]/20 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/executions/${r.execution_id}`} className="text-[#EDEAF8] hover:underline">
                  {r.agent_name}
                </Link>
                <span className="text-[#8A88A8] shrink-0">{formatTimeAgo(r.created_at)}</span>
              </div>
              {r.task_title && (
                <div className="text-[#8A88A8]">
                  on{' '}
                  <Link href={`/tasks/${r.task_id}`} className="hover:underline">
                    {r.task_title}
                  </Link>
                </div>
              )}
              {r.error && <div className="text-red-400/80">{r.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import Link from 'next/link'
import { TaskRetryRow } from '@/lib/types'
import { formatTimeAgo, getExecutionStatusColor } from '@/lib/utils'

export default function RetriesPanel({ rows }: { rows: TaskRetryRow[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Retries</h2>
      <p className="text-xs text-[#8A88A8] mb-2">
        Tasks with more than one execution row — there is no separate &quot;retry count&quot; anywhere in this system, this is that fact made visible.
      </p>
      {rows.length === 0 ? (
        <div className="text-xs text-[#8A88A8]">No task has been executed more than once.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.task_id} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-[#3C3A58]/20 last:border-0">
              <div className="min-w-0">
                <Link href={`/tasks/${r.task_id}`} className="text-[#EDEAF8] hover:underline">
                  {r.task_title}
                </Link>
                <div className="text-[#8A88A8] truncate">
                  <Link href={`/organizations/${r.organization_id}`} className="hover:underline">
                    {r.organization_name}
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">{r.execution_count} runs</span>
                <span className={`px-2 py-0.5 rounded-md border ${getExecutionStatusColor(r.last_status)}`}>{r.last_status}</span>
                <span className="text-[#8A88A8]">{formatTimeAgo(r.last_created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

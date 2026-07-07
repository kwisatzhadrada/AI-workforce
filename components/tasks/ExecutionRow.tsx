import Link from 'next/link'
import { AgentExecution } from '@/lib/types'
import { formatDuration, formatTimeAgo, getExecutionStatusColor, getInitials } from '@/lib/utils'

export default function ExecutionRow({ execution }: { execution: AgentExecution }) {
  return (
    <Link href={`/executions/${execution.id}`} className="flex items-center gap-3 bg-[#0C0D22] border border-[#3C3A58]/30 hover:border-[#6D28D9]/40 rounded-xl p-4 transition-colors">
      <div className="w-8 h-8 rounded-full bg-[#6D28D9] flex items-center justify-center text-xs font-semibold text-white shrink-0">
        {getInitials(execution.agents?.name || null)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[#EDEAF8] font-medium">{execution.agents?.name || 'Agent'}</span>
          {execution.agent_capabilities && <span className="text-xs text-[#8A88A8]">{execution.agent_capabilities.name}</span>}
          {execution.tasks && <span className="text-xs text-[#8A88A8]">· {execution.tasks.title}</span>}
        </div>
        <div className="text-xs text-[#8A88A8]">
          {execution.provider} {execution.model ? `· ${execution.model}` : ''}
          {execution.execution_time_ms != null && ` · ${formatDuration(Math.round(execution.execution_time_ms / 1000))}`}
          {execution.tokens_used != null && ` · ${execution.tokens_used} tokens`}
          {' · '}{formatTimeAgo(execution.created_at)}
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-md border shrink-0 ${getExecutionStatusColor(execution.status)}`}>{execution.status}</span>
    </Link>
  )
}

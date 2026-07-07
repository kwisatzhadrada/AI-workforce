import Link from 'next/link'
import { Task } from '@/lib/types'
import { getAssignmentPriorityColor, getTaskStatusColor, getInitials, formatTimeAgo } from '@/lib/utils'

export default function TaskCard({ task }: { task: Task }) {
  return (
    <Link href={`/tasks/${task.id}`} className="block bg-[#0C0D22] border border-[#3C3A58]/30 hover:border-[#6D28D9]/40 rounded-xl p-4 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-medium text-sm text-[#EDEAF8]">{task.title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-md border ${getAssignmentPriorityColor(task.priority)}`}>{task.priority}</span>
          <span className={`text-xs px-2 py-0.5 rounded-md border ${getTaskStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</span>
        </div>
      </div>
      {task.description && <p className="text-xs text-[#8A88A8] line-clamp-2 mb-2">{task.description}</p>}
      <div className="flex items-center gap-3 flex-wrap text-xs text-[#8A88A8]">
        {task.organizations && <span>{task.organizations.name}</span>}
        {task.organization_departments && <span>· {task.organization_departments.name}</span>}
        {task.agents && (
          <span className="flex items-center gap-1">
            · <span className="w-4 h-4 rounded-full bg-[#6D28D9] inline-flex items-center justify-center text-[9px] font-semibold text-white">{getInitials(task.agents.name)}</span>
            {task.agents.name}
          </span>
        )}
        {task.due_date && <span>· due {formatTimeAgo(task.due_date)}</span>}
        <span className="ml-auto">{formatTimeAgo(task.created_at)}</span>
      </div>
    </Link>
  )
}

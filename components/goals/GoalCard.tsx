import Link from 'next/link'
import { OrganizationGoal } from '@/lib/types'
import { getAssignmentPriorityColor, getGoalStatusColor, formatTimeAgo } from '@/lib/utils'

export default function GoalCard({ goal }: { goal: OrganizationGoal }) {
  return (
    <Link href={`/goals/${goal.id}`} className="block bg-[#0C0D22] border border-[#3C3A58]/30 hover:border-[#6D28D9]/40 rounded-xl p-4 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-medium text-sm text-[#EDEAF8]">{goal.title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-md border ${getAssignmentPriorityColor(goal.priority)}`}>{goal.priority}</span>
          <span className={`text-xs px-2 py-0.5 rounded-md border ${getGoalStatusColor(goal.status)}`}>{goal.status}</span>
          {goal.is_paused && <span className="text-xs px-2 py-0.5 rounded-md border text-yellow-400 bg-yellow-400/10 border-yellow-400/20">paused</span>}
        </div>
      </div>
      {goal.description && <p className="text-xs text-[#8A88A8] line-clamp-2 mb-2">{goal.description}</p>}
      <div className="flex items-center gap-3 flex-wrap text-xs text-[#8A88A8]">
        {goal.agents && <span>Manager: {goal.agents.name}</span>}
        {goal.deadline && <span>· due {formatTimeAgo(goal.deadline)}</span>}
        <span className="ml-auto">{formatTimeAgo(goal.created_at)}</span>
      </div>
    </Link>
  )
}

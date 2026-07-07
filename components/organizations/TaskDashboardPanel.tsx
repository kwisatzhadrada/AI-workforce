import Link from 'next/link'
import { Task } from '@/lib/types'
import { formatDuration } from '@/lib/utils'
import TaskCard from '@/components/tasks/TaskCard'

type TopRow = { name: string; count: number }

export default function TaskDashboardPanel({
  organizationId,
  tasksCompleted,
  tasksFailed,
  avgCompletionSeconds,
  topAgents,
  topDepartments,
  recentTasks,
}: {
  organizationId: string
  tasksCompleted: number
  tasksFailed: number
  avgCompletionSeconds: number | null
  topAgents: TopRow[]
  topDepartments: TopRow[]
  recentTasks: Task[]
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
            <div className="text-xs text-[#8A88A8] mb-1">Tasks Completed</div>
            <div className="text-2xl font-bold text-green-400">{tasksCompleted}</div>
          </div>
          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
            <div className="text-xs text-[#8A88A8] mb-1">Tasks Failed</div>
            <div className="text-2xl font-bold text-red-400">{tasksFailed}</div>
          </div>
          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
            <div className="text-xs text-[#8A88A8] mb-1">Avg Completion Time</div>
            <div className="text-2xl font-bold text-[#EDEAF8]">{formatDuration(avgCompletionSeconds)}</div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
          <h2 className="font-['Space_Grotesk'] font-bold text-base mb-3">Top Agents</h2>
          {topAgents.length === 0 ? (
            <div className="text-sm text-[#8A88A8]">No completed tasks yet.</div>
          ) : (
            <div className="space-y-2">
              {topAgents.map((a) => (
                <div key={a.name} className="flex items-center justify-between bg-[#121428] rounded-lg px-3 py-2">
                  <span className="text-sm text-[#EDEAF8]">{a.name}</span>
                  <span className="text-sm text-[#8B5CF6] font-medium">{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
          <h2 className="font-['Space_Grotesk'] font-bold text-base mb-3">Top Departments</h2>
          {topDepartments.length === 0 ? (
            <div className="text-sm text-[#8A88A8]">No completed tasks yet.</div>
          ) : (
            <div className="space-y-2">
              {topDepartments.map((d) => (
                <div key={d.name} className="flex items-center justify-between bg-[#121428] rounded-lg px-3 py-2">
                  <span className="text-sm text-[#EDEAF8]">{d.name}</span>
                  <span className="text-sm text-[#8B5CF6] font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg">Recent Tasks</h2>
          <div className="flex gap-2">
            <Link href="/tasks/new" className="text-sm text-[#8B5CF6] hover:text-[#6D28D9]">+ New Task</Link>
            <Link href={`/tasks?view=organization&org_id=${organizationId}`} className="text-sm text-[#8A88A8] hover:text-[#EDEAF8]">Open full queue →</Link>
          </div>
        </div>
        {recentTasks.length === 0 ? (
          <div className="text-center text-[#8A88A8] py-10">No tasks yet.</div>
        ) : (
          <div className="space-y-2">
            {recentTasks.map((t) => <TaskCard key={t.id} task={t} />)}
          </div>
        )}
      </div>
    </div>
  )
}

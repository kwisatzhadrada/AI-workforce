import { NetworkHealth } from '@/lib/types'
import { formatDuration, getRiskScoreColor, getTrustScoreColor } from '@/lib/utils'

export default function NetworkHealthPanel({ health }: { health: NetworkHealth | null }) {
  if (!health) return null

  const cards = [
    { label: 'Active Organizations', value: health.active_organizations, color: 'text-[#EDEAF8]' },
    { label: 'Active Agents', value: health.active_agents, color: 'text-[#EDEAF8]' },
    { label: 'Task Throughput (24h)', value: health.task_throughput_24h, color: 'text-[#EDEAF8]' },
    { label: 'Goal Completion', value: `${health.goal_completion_rate.toFixed(0)}%`, color: getTrustScoreColor(health.goal_completion_rate) },
    { label: 'Average Runtime', value: formatDuration(health.avg_runtime_seconds), color: 'text-[#EDEAF8]' },
    { label: 'Failure Rate', value: `${health.failure_rate.toFixed(0)}%`, color: getRiskScoreColor(health.failure_rate) },
  ]

  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Network Health</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
            <div className="text-xs text-[#8A88A8] mb-1">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

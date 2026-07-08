import { SimulationRun } from '@/lib/types'
import { formatDuration, formatTimeAgo, getSimulationStatusColor } from '@/lib/utils'

export default function SimulationRunsList({ runs }: { runs: SimulationRun[] }) {
  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Simulation Runs</h2>
      {runs.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
          No simulation runs yet. Run one to validate the network under load.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((r) => (
            <div key={r.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-md border ${getSimulationStatusColor(r.status)} capitalize`}>{r.status}</span>
                <span className="text-xs text-[#8A88A8]">{formatTimeAgo(r.started_at)} · {formatDuration(r.duration_seconds)}</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div><span className="text-[#8A88A8]">Orgs</span> <div className="text-[#EDEAF8] font-medium">{r.actual_organizations}/{r.target_organizations}</div></div>
                <div><span className="text-[#8A88A8]">Agents</span> <div className="text-[#EDEAF8] font-medium">{r.actual_agents}/{r.target_agents}</div></div>
                <div><span className="text-[#8A88A8]">Goals</span> <div className="text-[#EDEAF8] font-medium">{r.actual_goals}/{r.target_goals}</div></div>
                <div><span className="text-[#8A88A8]">Workflows</span> <div className="text-[#EDEAF8] font-medium">{r.actual_workflows}/{r.target_workflows}</div></div>
                <div><span className="text-[#8A88A8]">Tasks</span> <div className="text-[#EDEAF8] font-medium">{r.actual_tasks}/{r.target_tasks}</div></div>
              </div>
              {r.error && <div className="text-xs text-red-400 mt-2">{r.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

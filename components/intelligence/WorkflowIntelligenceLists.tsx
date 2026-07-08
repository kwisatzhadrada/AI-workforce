import { RankedWorkflow } from '@/lib/types'
import { getTrustScoreColor } from '@/lib/utils'

function WorkflowRow({ w }: { w: RankedWorkflow }) {
  return (
    <div className="flex items-center justify-between text-sm bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-3">
      <span className="text-[#EDEAF8]">{w.name}</span>
      <span className="text-xs text-[#8A88A8]">
        <span className={getTrustScoreColor(w.success_rate)}>{w.success_rate.toFixed(0)}%</span> success · {w.total_runs} runs
      </span>
    </div>
  )
}

export default function WorkflowIntelligenceLists({ best, worst }: { best: RankedWorkflow[]; worst: RankedWorkflow[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <h3 className="text-sm font-medium text-[#EDEAF8] mb-2">Best Performing</h3>
        <div className="space-y-2">
          {best.length === 0 ? <div className="text-xs text-[#8A88A8]">No workflow runs yet.</div> : best.map((w) => <WorkflowRow key={w.workflow_id} w={w} />)}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-[#EDEAF8] mb-2">Worst Performing</h3>
        <div className="space-y-2">
          {worst.length === 0 ? <div className="text-xs text-[#8A88A8]">No workflow runs yet.</div> : worst.map((w) => <WorkflowRow key={w.workflow_id} w={w} />)}
        </div>
      </div>
    </div>
  )
}

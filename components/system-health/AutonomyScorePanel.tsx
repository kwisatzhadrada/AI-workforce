import { AutonomyScore } from '@/lib/types'
import { getTrustScoreColor } from '@/lib/utils'

export default function AutonomyScorePanel({ score }: { score: AutonomyScore | null }) {
  if (!score) return null

  const sub = [
    { label: 'Tasks Auto-Created', value: score.pct_tasks_auto_created },
    { label: 'Tasks Auto-Completed', value: score.pct_tasks_auto_completed },
    { label: 'Goals Achieved Autonomously', value: score.pct_goals_autonomous },
    { label: 'Workflows Completed Autonomously', value: score.pct_workflows_autonomous },
  ]

  return (
    <div>
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Autonomy Score</h2>
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 mb-3 flex items-center gap-6">
        <div>
          <div className="text-xs text-[#8A88A8] mb-1">Overall</div>
          <div className={`text-4xl font-bold ${getTrustScoreColor(score.overall_score)}`}>{score.overall_score.toFixed(0)}</div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          {sub.map((s) => (
            <div key={s.label}>
              <div className="text-xs text-[#8A88A8]">{s.label}</div>
              <div className={`text-lg font-semibold ${getTrustScoreColor(s.value)}`}>{s.value.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { WorkforcePrediction } from '@/lib/types'
import { formatTimeAgo, getRiskScoreColor, getTrustScoreColor } from '@/lib/utils'

const RISK_TYPES = new Set(['agent_burnout_risk', 'organization_risk_score', 'workflow_failure_probability'])

export default function PredictionsList({ predictions }: { predictions: WorkforcePrediction[] }) {
  if (predictions.length === 0) {
    return <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">No predictions yet — refresh predictions for an organization above.</div>
  }

  return (
    <div className="space-y-2">
      {predictions.map((p) => {
        const isRisk = RISK_TYPES.has(p.prediction_type)
        const color = isRisk ? getRiskScoreColor(p.predicted_value) : getTrustScoreColor(p.predicted_value)
        return (
          <div key={p.id} className="flex items-center justify-between text-sm bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-3">
            <div>
              <span className="text-[#EDEAF8] capitalize">{p.prediction_type.replace(/_/g, ' ')}</span>
              <span className="text-xs text-[#8A88A8] ml-2 capitalize">{p.entity_type}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#8A88A8]">
              <span className={`font-semibold ${color}`}>{p.predicted_value.toFixed(0)}</span>
              <span>{Math.round(p.confidence * 100)}% confidence</span>
              <span>{formatTimeAgo(p.created_at)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

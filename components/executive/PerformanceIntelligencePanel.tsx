import { PerformanceIntelligence } from '@/lib/types'

export default function PerformanceIntelligencePanel({ performance }: { performance: PerformanceIntelligence | null }) {
  const hasAny = performance && (performance.best_icp || performance.best_message || performance.best_agent)

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h3 className="font-medium text-[#EDEAF8] mb-1">Performance Intelligence</h3>
      <p className="text-xs text-[#8A88A8] mb-3">Based only on real outcomes — not estimates.</p>
      {!hasAny ? (
        <p className="text-sm text-[#8A88A8]">Not enough real outcomes yet to identify what's working best.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {performance?.best_icp && (
            <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Best ICP</div>
              <div className="text-sm text-[#EDEAF8]">{performance.best_icp.icp.targetIndustry || 'Unspecified'}</div>
              <div className="text-xs text-[#8A88A8] mt-1">{performance.best_icp.reply_rate}% reply rate</div>
            </div>
          )}
          {performance?.best_message && (
            <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Best Message</div>
              <div className="text-sm text-[#EDEAF8] truncate">&ldquo;{performance.best_message.subject_line}&rdquo;</div>
              <div className="text-xs text-[#8A88A8] mt-1">{performance.best_message.reply_rate}% reply rate</div>
            </div>
          )}
          {performance?.best_agent && (
            <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
              <div className="text-xs text-[#8A88A8] mb-1">Best Agent</div>
              <div className="text-sm text-[#EDEAF8]">{performance.best_agent.agent_name}</div>
              <div className="text-xs text-[#8A88A8] mt-1">{performance.best_agent.meetings_booked} meeting(s) booked</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

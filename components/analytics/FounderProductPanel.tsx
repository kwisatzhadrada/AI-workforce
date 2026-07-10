import { UserFeedback } from '@/lib/types'

function FeedbackList({ items, emptyLabel }: { items: UserFeedback[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="text-xs text-[#8A88A8]">{emptyLabel}</p>
  return (
    <div className="space-y-1.5">
      {items.map((f) => (
        <div key={f.id} className="flex items-start justify-between gap-2 bg-[#121428] border border-[#3C3A58]/30 rounded-lg px-3 py-2">
          <span className="text-xs text-[#EDEAF8] line-clamp-2">{f.message}</span>
          {f.frequency > 1 && <span className="text-xs text-[#8A88A8] shrink-0">×{f.frequency}</span>}
        </div>
      ))}
    </div>
  )
}

// Ranked by frequency (how often the same real thing was reported) then
// recency — never a fabricated "trending" score.
function topByFrequency(items: UserFeedback[], n: number): UserFeedback[] {
  return [...items]
    .sort((a, b) => b.frequency - a.frequency || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, n)
}

export default function FounderProductPanel({ feedback }: { feedback: UserFeedback[] }) {
  const bugs = topByFrequency(feedback.filter((f) => f.feedback_type === 'bug'), 5)
  const featureRequests = topByFrequency(feedback.filter((f) => f.feedback_type === 'feature_request'), 5)
  const topOverall = topByFrequency(feedback, 5)

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Product</h2>
        <p className="text-xs text-[#8A88A8]">What design partners are telling us, ranked by how often it comes up.</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-[#EDEAF8] mb-2">Top Feedback</h3>
        <FeedbackList items={topOverall} emptyLabel="No feedback collected yet." />
      </div>
      <div>
        <h3 className="text-sm font-medium text-[#EDEAF8] mb-2">Top Bugs</h3>
        <FeedbackList items={bugs} emptyLabel="No bugs reported yet." />
      </div>
      <div>
        <h3 className="text-sm font-medium text-[#EDEAF8] mb-2">Feature Requests</h3>
        <FeedbackList items={featureRequests} emptyLabel="No feature requests yet." />
      </div>
    </div>
  )
}

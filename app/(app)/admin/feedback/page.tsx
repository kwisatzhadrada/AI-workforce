import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllFeedback } from '@/lib/feedback'
import { formatTimeAgo } from '@/lib/utils'
import FeedbackStatusControl from '@/components/feedback/FeedbackStatusControl'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { bug: '🐛 Bug', feature_request: '💡 Feature request', general: '💬 General' }
const STATUS_COLOR: Record<string, string> = {
  open: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  in_progress: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  resolved: 'text-green-400 bg-green-400/10 border-green-400/20',
  closed: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
}

export default async function AdminFeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const feedback = await getAllFeedback(supabase)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Feedback Inbox</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Bug reports, feature requests, and general feedback from every user.</p>
      </div>

      {feedback.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
          No feedback submitted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <div key={f.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#EDEAF8] font-medium">{TYPE_LABEL[f.feedback_type] || f.feedback_type}</span>
                  <span className="text-[#8A88A8]">from {f.profiles?.full_name || 'a user'}</span>
                  <span className="text-[#8A88A8]">· {formatTimeAgo(f.created_at)}</span>
                  {f.page_url && <span className="text-[#8A88A8]">· {f.page_url}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${STATUS_COLOR[f.status]}`}>{f.status.replace('_', ' ')}</span>
                  <FeedbackStatusControl feedbackId={f.id} currentStatus={f.status} />
                </div>
              </div>
              <p className="text-sm text-[#EDEAF8] whitespace-pre-wrap">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

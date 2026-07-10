import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdmins, getAllFeedback } from '@/lib/feedback'
import { formatTimeAgo } from '@/lib/utils'
import { FeedbackSeverity, FeedbackStatus, FeedbackType } from '@/lib/types'
import FeedbackTriageControl from '@/components/feedback/FeedbackTriageControl'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: '🐛 Bug',
  feature_request: '💡 Feature request',
  general: '💬 General',
  blocker: '🚧 Blocker',
  success_story: '🎉 Success story',
  onboarding_friction: '🧭 Onboarding friction',
}
const SEVERITY_COLOR: Record<FeedbackSeverity, string> = {
  low: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  medium: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  high: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
}
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  open: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  in_progress: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  resolved: 'text-green-400 bg-green-400/10 border-green-400/20',
  closed: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
}

const ALL_TYPES: FeedbackType[] = ['bug', 'feature_request', 'general', 'blocker', 'success_story', 'onboarding_friction']
const ALL_STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed']
const ALL_SEVERITIES: FeedbackSeverity[] = ['low', 'medium', 'high', 'critical']

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const typeFilter = typeof sp.type === 'string' ? sp.type : ''
  const statusFilter = typeof sp.status === 'string' ? sp.status : ''
  const severityFilter = typeof sp.severity === 'string' ? sp.severity : ''

  const [feedback, admins] = await Promise.all([getAllFeedback(supabase), getAdmins(supabase)])

  const filtered = feedback.filter((f) => {
    if (typeFilter && f.feedback_type !== typeFilter) return false
    if (statusFilter && f.status !== statusFilter) return false
    if (severityFilter && f.severity !== severityFilter) return false
    return true
  })

  function filterHref(next: { type?: string; status?: string; severity?: string }) {
    const params = new URLSearchParams()
    const type = next.type !== undefined ? next.type : typeFilter
    const status = next.status !== undefined ? next.status : statusFilter
    const severity = next.severity !== undefined ? next.severity : severityFilter
    if (type) params.set('type', type)
    if (status) params.set('status', status)
    if (severity) params.set('severity', severity)
    const qs = params.toString()
    return `/admin/feedback${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Feedback Inbox</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          Requested features, pain points, bugs, onboarding friction, and success stories from every design partner.
        </p>
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Link href={filterHref({ type: '' })} className={`text-xs px-2.5 py-1 rounded-lg border ${!typeFilter ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>All types</Link>
          {ALL_TYPES.map((t) => (
            <Link key={t} href={filterHref({ type: typeFilter === t ? '' : t })} className={`text-xs px-2.5 py-1 rounded-lg border ${typeFilter === t ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>
              {TYPE_LABEL[t]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href={filterHref({ status: '' })} className={`text-xs px-2.5 py-1 rounded-lg border ${!statusFilter ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>All statuses</Link>
          {ALL_STATUSES.map((s) => (
            <Link key={s} href={filterHref({ status: statusFilter === s ? '' : s })} className={`text-xs px-2.5 py-1 rounded-lg border capitalize ${statusFilter === s ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>
              {s.replace('_', ' ')}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href={filterHref({ severity: '' })} className={`text-xs px-2.5 py-1 rounded-lg border ${!severityFilter ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>All severities</Link>
          {ALL_SEVERITIES.map((s) => (
            <Link key={s} href={filterHref({ severity: severityFilter === s ? '' : s })} className={`text-xs px-2.5 py-1 rounded-lg border capitalize ${severityFilter === s ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8]'}`}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
          No feedback matches these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <div key={f.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-[#EDEAF8] font-medium">{TYPE_LABEL[f.feedback_type] || f.feedback_type}</span>
                  <span className={`px-2 py-0.5 rounded-md border ${SEVERITY_COLOR[f.severity]}`}>{f.severity}</span>
                  {f.frequency > 1 && <span className="px-2 py-0.5 rounded-md border text-[#8A88A8] bg-[#121428] border-[#3C3A58]">reported {f.frequency}x</span>}
                  <span className="text-[#8A88A8]">from {f.profiles?.full_name || 'a user'}</span>
                  <span className="text-[#8A88A8]">· {formatTimeAgo(f.created_at)}</span>
                  {f.page_url && <span className="text-[#8A88A8]">· {f.page_url}</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${STATUS_COLOR[f.status]}`}>{f.status.replace('_', ' ')}</span>
              </div>
              <p className="text-sm text-[#EDEAF8] whitespace-pre-wrap mb-3">{f.message}</p>
              <FeedbackTriageControl
                feedbackId={f.id}
                currentStatus={f.status}
                currentSeverity={f.severity}
                currentOwnerId={f.owner_id}
                admins={admins}
              />
              {f.owner && <div className="text-xs text-[#8A88A8] mt-1.5">Owned by {f.owner.full_name || 'Admin'}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

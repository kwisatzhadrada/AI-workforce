import { NextBestAction, ReplyClassification, ReplyClassificationType } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const CLASSIFICATION_LABEL: Record<ReplyClassificationType, string> = {
  interested: 'Interested',
  not_interested: 'Not interested',
  unsubscribe: 'Unsubscribe',
  objection: 'Objection',
  meeting_request: 'Meeting request',
  referral: 'Referral',
  wrong_contact: 'Wrong contact',
}

const CLASSIFICATION_TONE: Record<ReplyClassificationType, string> = {
  interested: 'text-green-400 bg-green-400/10 border-green-400/20',
  meeting_request: 'text-green-400 bg-green-400/10 border-green-400/20',
  referral: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  objection: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  not_interested: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  unsubscribe: 'text-red-400 bg-red-400/10 border-red-400/20',
  wrong_contact: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
}

export default function NextBestActionPanel({
  nextBestActions,
  replyClassifications,
}: {
  nextBestActions: NextBestAction[]
  replyClassifications: ReplyClassification[]
}) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-5">
      <div>
        <h3 className="font-medium text-[#EDEAF8] mb-1">Follow-Up Intelligence</h3>
        <p className="text-xs text-[#8A88A8] mb-3">The state of every prospect conversation — what needs a response, oldest first.</p>
        {nextBestActions.length === 0 ? (
          <p className="text-sm text-[#8A88A8]">No prospects currently need follow-up.</p>
        ) : (
          <div className="space-y-2">
            {nextBestActions.map((a) => (
              <div key={a.contact_email} className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <span className="text-sm text-[#EDEAF8]">{a.contact_name || a.contact_email}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md border ${CLASSIFICATION_TONE[a.classification]}`}>
                    {CLASSIFICATION_LABEL[a.classification]}
                  </span>
                </div>
                <div className="text-xs text-[#8A88A8]">{a.suggested_action} · {a.days_since} day(s) since last classified</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium text-[#EDEAF8] mb-2">Recent Reply Classifications</h4>
        {replyClassifications.length === 0 ? (
          <p className="text-sm text-[#8A88A8]">No replies classified yet.</p>
        ) : (
          <div className="space-y-2">
            {replyClassifications.map((c) => (
              <div key={c.id} className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <span className="text-sm text-[#EDEAF8]">{c.contact_name || c.contact_email}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-md border ${CLASSIFICATION_TONE[c.classification]}`}>
                      {CLASSIFICATION_LABEL[c.classification]}
                    </span>
                    <span className="text-xs text-[#8A88A8]">{formatTimeAgo(c.created_at)}</span>
                  </div>
                </div>
                {c.reasoning && <div className="text-xs text-[#8A88A8]">{c.reasoning}</div>}
                {c.action_items.length > 0 && (
                  <ul className="text-xs text-[#8A88A8] list-disc list-inside mt-1">
                    {c.action_items.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

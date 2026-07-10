'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { upsertDesignPartner } from '@/lib/designPartners'
import { DesignPartnerStatus, HealthStatus } from '@/lib/types'
import HealthBadge from './HealthBadge'

function formatDealCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const STATUS_COLOR: Record<DesignPartnerStatus, string> = {
  prospect: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  contacted: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  demo_scheduled: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  trial_active: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  active_user: 'text-green-400 bg-green-400/10 border-green-400/20',
  paying_customer: 'text-green-400 bg-green-400/10 border-green-400/20',
  churned: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const STATUS_LABEL: Record<DesignPartnerStatus, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  demo_scheduled: 'Demo Scheduled',
  trial_active: 'Trial Active',
  active_user: 'Active User',
  paying_customer: 'Paying Customer',
  churned: 'Churned',
}

export type DesignPartnerRowData = {
  organizationId: string
  organizationName: string
  industry: string | null
  companySize: string | null
  contactName: string | null
  contactEmail: string | null
  contactRole: string | null
  status: DesignPartnerStatus
  satisfactionScore: number | null
  requestedFeatures: string | null
  feedbackNotes: string | null
  meetingNotes: string | null
  organizationsCreated: number
  campaignsLaunched: number
  emailsSent: number
  repliesReceived: number
  meetingsBooked: number
  healthStatus: HealthStatus | null
  revenueWon: number | null
  pipelineOpen: number | null
  openSupportConversations: number
}

export default function DesignPartnerRow({ data }: { data: DesignPartnerRowData }) {
  const supabase = createClient()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [contactName, setContactName] = useState(data.contactName || '')
  const [contactEmail, setContactEmail] = useState(data.contactEmail || '')
  const [contactRole, setContactRole] = useState(data.contactRole || '')
  const [status, setStatus] = useState<DesignPartnerStatus>(data.status)
  const [satisfactionScore, setSatisfactionScore] = useState(data.satisfactionScore?.toString() || '')
  const [requestedFeatures, setRequestedFeatures] = useState(data.requestedFeatures || '')
  const [feedbackNotes, setFeedbackNotes] = useState(data.feedbackNotes || '')
  const [meetingNotes, setMeetingNotes] = useState(data.meetingNotes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const { error } = await upsertDesignPartner(supabase, {
      organizationId: data.organizationId,
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactRole: contactRole.trim() || null,
      status,
      satisfactionScore: satisfactionScore ? Number(satisfactionScore) : null,
      requestedFeatures: requestedFeatures.trim() || null,
      feedbackNotes: feedbackNotes.trim() || null,
      meetingNotes: meetingNotes.trim() || null,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/admin/design-partners/${data.organizationId}`} className="text-[#EDEAF8] font-medium hover:underline">
            {data.organizationName}
          </Link>
          {data.industry && <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">{data.industry}</span>}
          {data.companySize && <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">{data.companySize}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-md border ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
          {data.healthStatus && <HealthBadge status={data.healthStatus} />}
        </div>
        <button onClick={() => setEditing((v) => !v)} className="text-xs text-[#6D28D9] hover:underline">
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-2">
        <div><div className="text-[#8A88A8]">Organizations</div><div className="text-[#EDEAF8] tabular-nums">{data.organizationsCreated}</div></div>
        <div><div className="text-[#8A88A8]">Campaigns</div><div className="text-[#EDEAF8] tabular-nums">{data.campaignsLaunched}</div></div>
        <div><div className="text-[#8A88A8]">Emails Sent</div><div className="text-[#EDEAF8] tabular-nums">{data.emailsSent}</div></div>
        <div><div className="text-[#8A88A8]">Replies</div><div className="text-[#EDEAF8] tabular-nums">{data.repliesReceived}</div></div>
        <div><div className="text-[#8A88A8]">Meetings</div><div className="text-[#EDEAF8] tabular-nums">{data.meetingsBooked}</div></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-2 pt-2 border-t border-[#3C3A58]/30">
        <div>
          <div className="text-[#8A88A8]">Revenue Won</div>
          <div className="text-green-400 tabular-nums">{data.revenueWon != null ? formatDealCurrency(data.revenueWon) : '—'}</div>
        </div>
        <div>
          <div className="text-[#8A88A8]">Open Pipeline</div>
          <div className="text-[#EDEAF8] tabular-nums">{data.pipelineOpen != null ? formatDealCurrency(data.pipelineOpen) : '—'}</div>
        </div>
        <div>
          <div className="text-[#8A88A8]">Support</div>
          <div className={`tabular-nums ${data.openSupportConversations > 0 ? 'text-yellow-400' : 'text-[#EDEAF8]'}`}>
            {data.openSupportConversations > 0 ? `${data.openSupportConversations} open` : 'All clear'}
          </div>
        </div>
      </div>

      {!editing && (
        <div className="text-xs text-[#8A88A8] space-y-0.5">
          {data.contactName || data.contactEmail ? (
            <div>Contact: {[data.contactName, data.contactRole].filter(Boolean).join(', ')} {data.contactEmail && `· ${data.contactEmail}`}</div>
          ) : (
            <div>No contact on file.</div>
          )}
          {data.satisfactionScore != null && <div>Satisfaction: {data.satisfactionScore}/10</div>}
          {data.requestedFeatures && <div>Feature requests: {data.requestedFeatures}</div>}
          {data.meetingNotes && <div>Meeting notes: {data.meetingNotes}</div>}
          {data.feedbackNotes && <div>Feedback notes: {data.feedbackNotes}</div>}
        </div>
      )}

      {editing && (
        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name"
              className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email"
              className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
            <input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="Role (e.g. Founder)"
              className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
            <select value={status} onChange={(e) => setStatus(e.target.value as DesignPartnerStatus)}
              className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]">
              {(Object.keys(STATUS_LABEL) as DesignPartnerStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <input type="number" min={1} max={10} value={satisfactionScore} onChange={(e) => setSatisfactionScore(e.target.value)} placeholder="Satisfaction (1-10)"
              className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          </div>
          <textarea value={requestedFeatures} onChange={(e) => setRequestedFeatures(e.target.value)} rows={2} placeholder="Feature requests"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <textarea value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} rows={2} placeholder="Meeting notes"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <textarea value={feedbackNotes} onChange={(e) => setFeedbackNotes(e.target.value)} rows={2} placeholder="Feedback notes"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <button onClick={save} disabled={saving}
            className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      )}
    </div>
  )
}

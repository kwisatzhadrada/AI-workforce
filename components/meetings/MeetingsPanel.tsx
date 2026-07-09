'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createMeeting, updateMeetingStatus } from '@/lib/meetings'
import { Meeting, MeetingFunnel, MeetingStatus } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const STATUS_COLOR: Record<MeetingStatus, string> = {
  requested: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  scheduled: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  completed: 'text-green-400 bg-green-400/10 border-green-400/20',
  cancelled: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const NEXT_STATUS: Record<MeetingStatus, MeetingStatus | null> = {
  requested: 'scheduled',
  scheduled: 'completed',
  completed: null,
  cancelled: null,
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function advance() {
    const next = NEXT_STATUS[meeting.status]
    if (!next) return
    setSaving(true)
    await updateMeetingStatus(supabase, meeting.id, next)
    setSaving(false)
    router.refresh()
  }

  async function cancel() {
    setSaving(true)
    await updateMeetingStatus(supabase, meeting.id, 'cancelled')
    setSaving(false)
    router.refresh()
  }

  const next = NEXT_STATUS[meeting.status]

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[#3C3A58]/20 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-[#EDEAF8] truncate">{meeting.contact_name || meeting.contact_email}</div>
        <div className="text-xs text-[#8A88A8] truncate">
          {meeting.contact_company ? `${meeting.contact_company} · ` : ''}{formatTimeAgo(meeting.created_at)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${STATUS_COLOR[meeting.status]}`}>{meeting.status}</span>
        {next && (
          <button onClick={advance} disabled={saving} className="text-xs px-2 py-1 rounded-md bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white">
            Mark {next}
          </button>
        )}
        {meeting.status !== 'cancelled' && meeting.status !== 'completed' && (
          <button onClick={cancel} disabled={saving} className="text-xs px-2 py-1 rounded-md border border-[#3C3A58] text-[#8A88A8] hover:text-red-400 hover:border-red-400/40 disabled:opacity-50">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export default function MeetingsPanel({
  organizationId, meetings, funnel,
}: {
  organizationId: string
  meetings: Meeting[]
  funnel: MeetingFunnel | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!email.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await createMeeting(supabase, {
      organizationId, contactEmail: email.trim(), contactName: name.trim() || null, contactCompany: company.trim() || null,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setEmail('')
    setName('')
    setCompany('')
    router.refresh()
  }

  const stages: { key: keyof MeetingFunnel; label: string }[] = [
    { key: 'requested', label: 'Requested' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5 space-y-4">
      <h3 className="font-medium text-[#EDEAF8]">Meetings</h3>

      {funnel && funnel.total > 0 && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {stages.map((s) => (
            <div key={s.key} className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg py-2">
              <div className="text-lg font-bold text-[#EDEAF8] tabular-nums">{funnel[s.key]}</div>
              <div className="text-[10px] text-[#8A88A8]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs text-[#8A88A8] mb-2">
          Meeting scheduling isn&apos;t automated (no calendar integration yet) — log it here once a prospect confirms, then move it through Scheduled → Completed as it happens.
        </p>
        <div className="flex flex-wrap gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Contact email"
            className="flex-1 min-w-[140px] bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact name (optional)"
            className="flex-1 min-w-[140px] bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)"
            className="flex-1 min-w-[140px] bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <button onClick={submit} disabled={saving || !email.trim()}
            className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {saving ? 'Saving...' : 'Log Meeting'}
          </button>
        </div>
        {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
      </div>

      {meetings.length > 0 && (
        <div>
          {meetings.map((m) => <MeetingRow key={m.id} meeting={m} />)}
        </div>
      )}
    </div>
  )
}

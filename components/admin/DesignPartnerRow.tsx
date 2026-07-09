'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { upsertDesignPartner } from '@/lib/designPartners'
import { DesignPartnerStatus } from '@/lib/types'

const STATUS_COLOR: Record<DesignPartnerStatus, string> = {
  active: 'text-green-400 bg-green-400/10 border-green-400/20',
  paused: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  churned: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export type DesignPartnerRowData = {
  organizationId: string
  organizationName: string
  contactName: string | null
  contactEmail: string | null
  contactRole: string | null
  status: DesignPartnerStatus
  satisfactionScore: number | null
  requestedFeatures: string | null
  notes: string | null
  usageSignal: string
  meetingsBooked: number
  feedbackCount: number
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
  const [notes, setNotes] = useState(data.notes || '')
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
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <span className="text-[#EDEAF8] font-medium">{data.organizationName}</span>
          <span className={`ml-2 text-xs px-2 py-0.5 rounded-md border capitalize ${STATUS_COLOR[status]}`}>{status}</span>
        </div>
        <button onClick={() => setEditing((v) => !v)} className="text-xs text-[#6D28D9] hover:underline">
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
        <div>
          <div className="text-[#8A88A8]">Usage</div>
          <div className="text-[#EDEAF8]">{data.usageSignal}</div>
        </div>
        <div>
          <div className="text-[#8A88A8]">Meetings</div>
          <div className="text-[#EDEAF8] tabular-nums">{data.meetingsBooked}</div>
        </div>
        <div>
          <div className="text-[#8A88A8]">Feedback</div>
          <div className="text-[#EDEAF8] tabular-nums">{data.feedbackCount}</div>
        </div>
        <div>
          <div className="text-[#8A88A8]">Satisfaction</div>
          <div className="text-[#EDEAF8]">{data.satisfactionScore != null ? `${data.satisfactionScore}/10` : '—'}</div>
        </div>
      </div>

      {!editing && (
        <div className="text-xs text-[#8A88A8] space-y-0.5">
          {data.contactName || data.contactEmail ? (
            <div>Contact: {[data.contactName, data.contactRole].filter(Boolean).join(', ')} {data.contactEmail && `· ${data.contactEmail}`}</div>
          ) : (
            <div>No contact on file.</div>
          )}
          {data.requestedFeatures && <div>Requested: {data.requestedFeatures}</div>}
          {data.notes && <div>Notes: {data.notes}</div>}
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
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="churned">Churned</option>
            </select>
            <input type="number" min={1} max={10} value={satisfactionScore} onChange={(e) => setSatisfactionScore(e.target.value)} placeholder="Satisfaction (1-10)"
              className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          </div>
          <textarea value={requestedFeatures} onChange={(e) => setRequestedFeatures(e.target.value)} rows={2} placeholder="Requested features"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes"
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

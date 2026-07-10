'use client'

import { useState } from 'react'
import { JourneyMilestone } from '@/lib/types'

const LABEL: Record<JourneyMilestone['milestone'], string> = {
  signup: 'Signed up',
  template_deployed: 'Deployed a workforce template',
  gmail_connected: 'Connected Gmail',
  campaign_launched: 'Launched a campaign',
  first_email_approved: 'Approved first email',
  first_reply_received: 'Received first reply',
  first_meeting_booked: 'Booked first meeting',
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

// A real timeline replay over already-logged milestones — step through
// what actually happened and how long each gap took, to see exactly
// where a user stalled, rather than a live client-side session recorder.
export default function JourneyTimeline({ milestones }: { milestones: JourneyMilestone[] }) {
  const reached = milestones.filter((m) => m.occurred_at)
  const notReached = milestones.filter((m) => !m.occurred_at)
  const [step, setStep] = useState(reached.length > 0 ? reached.length - 1 : 0)

  if (reached.length === 0) {
    return <p className="text-sm text-[#8A88A8]">No journey data yet.</p>
  }

  const current = reached[step]
  const prev = step > 0 ? reached[step - 1] : null
  const gapMs = prev ? new Date(current.occurred_at!).getTime() - new Date(prev.occurred_at!).getTime() : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-xs px-2 py-1 rounded-md border border-[#3C3A58] text-[#8A88A8] hover:text-[#EDEAF8] disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="text-xs text-[#8A88A8]">Step {step + 1} of {reached.length}</span>
        <button
          onClick={() => setStep((s) => Math.min(reached.length - 1, s + 1))}
          disabled={step === reached.length - 1}
          className="text-xs px-2 py-1 rounded-md border border-[#3C3A58] text-[#8A88A8] hover:text-[#EDEAF8] disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4">
        <div className="text-sm text-[#EDEAF8] font-medium">{LABEL[current.milestone]}</div>
        <div className="text-xs text-[#8A88A8] mt-1">{new Date(current.occurred_at!).toLocaleString()}</div>
        {prev && <div className="text-xs text-[#8A88A8] mt-1">{formatDuration(gapMs)} after &ldquo;{LABEL[prev.milestone]}&rdquo;</div>}
      </div>

      <div>
        {reached.map((m, i) => (
          <div key={m.milestone} className="flex items-center gap-2 py-1">
            <div className={`w-2 h-2 rounded-full shrink-0 ${i === step ? 'bg-[#6D28D9]' : 'bg-green-400'}`} />
            <span className={`text-xs ${i === step ? 'text-[#EDEAF8] font-medium' : 'text-[#8A88A8]'}`}>{LABEL[m.milestone]}</span>
            <span className="text-[10px] text-[#8A88A8] ml-auto">{new Date(m.occurred_at!).toLocaleDateString()}</span>
          </div>
        ))}
        {notReached.map((m) => (
          <div key={m.milestone} className="flex items-center gap-2 py-1 opacity-50">
            <div className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
            <span className="text-xs text-[#8A88A8]">{LABEL[m.milestone]} — not yet</span>
          </div>
        ))}
      </div>
    </div>
  )
}

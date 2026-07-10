'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateDesignPartnerReport } from '@/lib/designPartnerReports'
import { DesignPartnerReport } from '@/lib/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ReportDetail({ report }: { report: DesignPartnerReport }) {
  const c = report.content
  return (
    <div className="bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-4 mt-2 space-y-3">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><div className="text-xs text-[#8A88A8]">Adoption</div><div className="text-[#EDEAF8] tabular-nums">{c.adoption_score}</div></div>
        <div><div className="text-xs text-[#8A88A8]">Success</div><div className="text-[#EDEAF8] tabular-nums">{c.success_score}</div></div>
        <div><div className="text-xs text-[#8A88A8]">Risk</div><div className="text-[#EDEAF8] tabular-nums">{c.risk_score}</div></div>
      </div>
      <div>
        <div className="text-xs text-[#8A88A8] mb-1">Usage & Engagement (last 7 days)</div>
        <div className="text-sm text-[#EDEAF8]">{c.leads_found} leads found · {c.emails_sent} emails sent · {c.replies_received} replies received</div>
      </div>
      <div>
        <div className="text-xs text-[#8A88A8] mb-1">Feedback</div>
        <div className="text-sm text-[#EDEAF8]">{c.requested_features || 'No feature requests on file.'}</div>
        <div className="text-sm text-[#8A88A8]">{c.complaints_this_period} bug report(s) this period.</div>
        {c.blockers_this_period.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {c.blockers_this_period.map((b, i) => (
              <li key={i} className="text-xs text-[#8A88A8]">→ {b.reason || 'other'}: {b.message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function DesignPartnerReportPanel({ organizationId, reports }: { organizationId: string; reports: DesignPartnerReport[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(reports[0]?.id || null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setGenerating(true)
    setError(null)
    const { report, error } = await generateDesignPartnerReport(supabase, organizationId)
    setGenerating(false)
    if (error) { setError(error); return }
    if (report) setExpandedId(report.id)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <button onClick={generate} disabled={generating}
        className="text-sm px-3 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white">
        {generating ? 'Generating...' : 'Generate Report (Adoption + Success + Feedback)'}
      </button>
      {error && <div className="text-xs text-red-400">{error}</div>}

      {reports.length === 0 ? (
        <p className="text-sm text-[#8A88A8]">No reports generated yet.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id}>
              <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} className="text-sm text-[#EDEAF8] hover:underline">
                {formatDate(r.period_start)} – {formatDate(r.period_end)}
              </button>
              {expandedId === r.id && <ReportDetail report={r} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

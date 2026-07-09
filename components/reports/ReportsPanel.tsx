'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateOrganizationReport } from '@/lib/reports'
import { OrganizationReport, OrganizationReportType } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TYPE_LABEL: Record<OrganizationReportType, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' }

function ReportDetail({ organizationName, report }: { organizationName: string; report: OrganizationReport }) {
  const c = report.content
  return (
    <div className="print-area bg-[#121428] border border-[#3C3A58]/30 rounded-lg p-5 mt-3">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h4 className="font-['Space_Grotesk'] font-bold text-[#EDEAF8]">
            {organizationName} — {TYPE_LABEL[report.report_type]} Success Report
          </h4>
          <p className="text-xs text-[#8A88A8]">{formatDate(report.period_start)} – {formatDate(report.period_end)}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print text-xs px-3 py-1.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div><div className="text-xs text-[#8A88A8]">Leads Found</div><div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{c.leads_found}</div></div>
        <div><div className="text-xs text-[#8A88A8]">Emails Sent</div><div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{c.emails_sent}</div></div>
        <div><div className="text-xs text-[#8A88A8]">Replies Received</div><div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{c.replies_received}</div></div>
        <div><div className="text-xs text-[#8A88A8]">Meetings Booked</div><div className="text-xl font-bold text-[#EDEAF8] tabular-nums">{c.meetings_booked}</div></div>
      </div>

      <div className="mb-4">
        <h5 className="text-sm font-medium text-[#EDEAF8] mb-2">Meeting Funnel</h5>
        <div className="grid grid-cols-4 gap-3 text-sm text-[#8A88A8]">
          <div>Requested: <span className="text-[#EDEAF8] tabular-nums">{c.meetings_requested}</span></div>
          <div>Scheduled: <span className="text-[#EDEAF8] tabular-nums">{c.meetings_scheduled}</span></div>
          <div>Completed: <span className="text-[#EDEAF8] tabular-nums">{c.meetings_completed}</span></div>
          <div>Cancelled: <span className="text-[#EDEAF8] tabular-nums">{c.meetings_cancelled}</span></div>
        </div>
      </div>

      <div>
        <h5 className="text-sm font-medium text-[#EDEAF8] mb-2">Recommended Actions</h5>
        {c.recommendations.length === 0 ? (
          <p className="text-sm text-[#8A88A8]">No recommendations this period.</p>
        ) : (
          <ul className="space-y-1">
            {c.recommendations.map((r, i) => <li key={i} className="text-sm text-[#EDEAF8]">→ {r}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function ReportsPanel({
  organizationId, organizationName, reports,
}: {
  organizationId: string
  organizationName: string
  reports: OrganizationReport[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [generating, setGenerating] = useState<OrganizationReportType | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(reports[0]?.id || null)
  const [error, setError] = useState<string | null>(null)

  async function generate(type: OrganizationReportType) {
    setGenerating(type)
    setError(null)
    const { report, error } = await generateOrganizationReport(supabase, organizationId, type)
    setGenerating(null)
    if (error) { setError(error); return }
    if (report) setExpandedId(report.id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="no-print bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
        <h3 className="font-medium text-[#EDEAF8] mb-2">Customer Success Reports</h3>
        <p className="text-xs text-[#8A88A8] mb-3">
          Generate a report covering campaign performance, lead generation, response rates, meetings booked, and recommended next steps.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['weekly', 'monthly', 'quarterly'] as OrganizationReportType[]).map((t) => (
            <button
              key={t}
              onClick={() => generate(t)}
              disabled={generating !== null}
              className="text-sm px-3 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white"
            >
              {generating === t ? 'Generating...' : `Generate ${TYPE_LABEL[t]}`}
            </button>
          ))}
        </div>
        {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
      </div>

      {reports.length === 0 ? (
        <div className="no-print text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
          No reports yet — generate one above.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className={`${expandedId === r.id ? 'print-area' : 'no-print'} bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4`}>
              <button
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                className="no-print w-full flex items-center justify-between text-left"
              >
                <span className="text-sm text-[#EDEAF8]">
                  {TYPE_LABEL[r.report_type]} — {formatDate(r.period_start)} to {formatDate(r.period_end)}
                </span>
                <span className="text-xs text-[#8A88A8]">{formatTimeAgo(r.created_at)}</span>
              </button>
              {expandedId === r.id && <ReportDetail organizationName={organizationName} report={r} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

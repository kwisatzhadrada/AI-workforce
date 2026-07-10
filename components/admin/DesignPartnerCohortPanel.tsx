import Link from 'next/link'
import { DesignPartnerCohortRow } from '@/lib/types'

export default function DesignPartnerCohortPanel({ rows }: { rows: DesignPartnerCohortRow[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Design Partner Cohort</h2>
      <p className="text-xs text-[#8A88A8] mb-3">
        Every organization officially tracked as a design partner ({rows.length} of them) and their real outcomes.
      </p>
      {rows.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-6 text-sm">
          No design partners tracked yet — add one from the list below.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#8A88A8] border-b border-[#3C3A58]/30">
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3 text-right">Orgs</th>
                <th className="py-2 pr-3 text-right">Campaigns</th>
                <th className="py-2 pr-3 text-right">Emails Sent</th>
                <th className="py-2 pr-3 text-right">Replies</th>
                <th className="py-2 pr-3 text-right">Meetings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.organization_id} className="border-b border-[#3C3A58]/10 last:border-0">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/design-partners/${r.organization_id}`} className="text-[#EDEAF8] hover:underline">{r.organization_name}</Link>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.organizations_created}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.campaigns_launched}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.emails_sent}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.replies_received}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.meetings_booked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

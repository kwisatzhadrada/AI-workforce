import Link from 'next/link'
import { AnalyticsByOrganization } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

function Check({ value }: { value: boolean }) {
  return <span className={value ? 'text-green-400' : 'text-[#3C3A58]'}>{value ? '✓' : '—'}</span>
}

export default function OrganizationsTable({ rows }: { rows: AnalyticsByOrganization[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-5">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Organizations</h2>
      {rows.length === 0 ? (
        <div className="text-xs text-[#8A88A8]">No organizations yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8A88A8] border-b border-[#3C3A58]/30">
                <th className="py-1.5 pr-3">Organization</th>
                <th className="py-1.5 pr-3">Created</th>
                <th className="py-1.5 pr-3">Workforce</th>
                <th className="py-1.5 pr-3">Campaign</th>
                <th className="py-1.5 pr-3 text-right">Drafted</th>
                <th className="py-1.5 pr-3 text-right">Sent</th>
                <th className="py-1.5 pr-3 text-right">Replies</th>
                <th className="py-1.5 pr-3 text-right">Meetings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.organization_id} className="border-b border-[#3C3A58]/10 last:border-0">
                  <td className="py-1.5 pr-3">
                    <Link href={`/organizations/${r.organization_id}?tab=campaign`} className="text-[#EDEAF8] hover:underline">
                      {r.organization_name}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-[#8A88A8]">{formatTimeAgo(r.created_at)}</td>
                  <td className="py-1.5 pr-3"><Check value={r.workforce_deployed} /></td>
                  <td className="py-1.5 pr-3"><Check value={r.campaign_launched} /></td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.emails_drafted}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.emails_sent}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.replies_received}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-[#EDEAF8]">{r.meetings_booked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

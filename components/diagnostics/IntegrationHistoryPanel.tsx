import Link from 'next/link'
import { IntegrationHistoryRow } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

const TYPE_COLOR: Record<string, string> = {
  integration_connected: 'text-green-400 bg-green-400/10 border-green-400/20',
  integration_disconnected: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  integration_error: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const TYPE_LABEL: Record<string, string> = {
  integration_connected: 'connected',
  integration_disconnected: 'disconnected',
  integration_error: 'error',
}

export default function IntegrationHistoryPanel({ rows }: { rows: IntegrationHistoryRow[] }) {
  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Integration History</h2>
      {rows.length === 0 ? (
        <div className="text-xs text-[#8A88A8]">No integration events yet.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-[#3C3A58]/20 last:border-0">
              <div className="min-w-0">
                <Link href={`/organizations/${r.organization_id}?tab=integrations`} className="text-[#EDEAF8] hover:underline">
                  {r.organization_name}
                </Link>
                <span className="text-[#8A88A8]"> — {String(r.payload.provider || '')}</span>
                {typeof r.payload.error === 'string' && <div className="text-red-400/80 truncate">{r.payload.error}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-md border ${TYPE_COLOR[r.activity_type] || ''}`}>{TYPE_LABEL[r.activity_type] || r.activity_type}</span>
                <span className="text-[#8A88A8]">{formatTimeAgo(r.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

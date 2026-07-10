import Link from 'next/link'
import { PartnerWorkspaceData } from '@/lib/types'

const INTEGRATION_LABEL: Record<string, string> = { gmail: 'Email', hubspot: 'CRM', hunter: 'Lead Finder' }

const CAMPAIGN_STATUS_LABEL: Record<PartnerWorkspaceData['campaignStatus'], string> = {
  not_started: 'Not started yet',
  active: 'Running',
  paused: 'Paused',
  completed: 'Completed',
}

const CAMPAIGN_STATUS_COLOR: Record<PartnerWorkspaceData['campaignStatus'], string> = {
  not_started: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  active: 'text-green-400 bg-green-400/10 border-green-400/20',
  paused: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  completed: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
}

export default function PartnerWorkspacePanel({ organizationId, data }: { organizationId: string; data: PartnerWorkspaceData }) {
  return (
    <div className="space-y-6">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-['Space_Grotesk'] font-bold text-lg">Getting Started</h2>
          <span className="text-sm text-[#8A88A8]">{data.completedCount}/{data.totalCount} done</span>
        </div>
        <p className="text-xs text-[#8A88A8] mb-4">Your path from signing up to your first real customer conversation.</p>
        <div className="space-y-2">
          {data.checklist.map((item, i) => (
            <div key={item.key} className="flex items-center gap-3 bg-[#121428] border border-[#3C3A58]/30 rounded-xl p-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  item.done ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#0C0D22] text-[#8A88A8] border border-[#3C3A58]'
                }`}
              >
                {item.done ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${item.done ? 'text-[#EDEAF8]' : 'text-[#8A88A8]'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
          <h3 className="font-medium text-[#EDEAF8] mb-3">Connections</h3>
          {data.integrations.length === 0 ? (
            <p className="text-sm text-[#8A88A8]">Nothing connected yet.</p>
          ) : (
            <div className="space-y-2">
              {data.integrations.map((i) => (
                <div key={i.provider} className="flex items-center justify-between text-sm">
                  <span className="text-[#EDEAF8]">{INTEGRATION_LABEL[i.provider] || i.provider}</span>
                  <span className={i.status === 'connected' ? 'text-green-400' : 'text-[#8A88A8]'}>
                    {i.status === 'connected' ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href={`/organizations/${organizationId}?tab=integrations`} className="block mt-3 text-xs text-[#6D28D9] hover:underline">
            Manage connections →
          </Link>
        </div>

        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
          <h3 className="font-medium text-[#EDEAF8] mb-3">Campaign</h3>
          <span className={`text-xs px-2 py-0.5 rounded-md border ${CAMPAIGN_STATUS_COLOR[data.campaignStatus]}`}>
            {CAMPAIGN_STATUS_LABEL[data.campaignStatus]}
          </span>
          <Link href={`/organizations/${organizationId}?tab=campaign`} className="block mt-3 text-xs text-[#6D28D9] hover:underline">
            Open campaign →
          </Link>
        </div>

        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
          <h3 className="font-medium text-[#EDEAF8] mb-3">Meetings Booked</h3>
          <div className="text-3xl font-bold text-[#EDEAF8] tabular-nums">{data.meetingsBooked}</div>
          <Link href={`/organizations/${organizationId}?tab=campaign`} className="block mt-3 text-xs text-[#6D28D9] hover:underline">
            View meetings →
          </Link>
        </div>

        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
          <h3 className="font-medium text-[#EDEAF8] mb-3">Support</h3>
          {data.openSupportConversations > 0 ? (
            <span className="text-sm text-yellow-400">{data.openSupportConversations} open conversation{data.openSupportConversations === 1 ? '' : 's'}</span>
          ) : (
            <span className="text-sm text-green-400">All clear</span>
          )}
          <Link href="/support" className="block mt-3 text-xs text-[#6D28D9] hover:underline">
            Contact support →
          </Link>
        </div>
      </div>
    </div>
  )
}

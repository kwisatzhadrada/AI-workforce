import { connectHubSpot, connectHunter } from '@/lib/sales'
import { OrganizationIntegration } from '@/lib/types'
import { formatTimeAgo, getIntegrationStatusColor } from '@/lib/utils'
import TokenConnectForm from './TokenConnectForm'
import DisconnectButton from './DisconnectButton'

const PROVIDERS = [
  {
    provider: 'gmail' as const,
    name: 'Gmail',
    description: 'The Outreach Agent sends real, personalized email through your connected Gmail account and checks real replies.',
  },
  {
    provider: 'hubspot' as const,
    name: 'HubSpot',
    description: 'The CRM Agent creates and updates real contact records and logs outreach activity on them.',
  },
  {
    provider: 'hunter' as const,
    name: 'Hunter.io',
    description: 'The Lead Research Agent enriches target company domains into real decision-maker contacts.',
  },
]

export default function IntegrationsPanel({
  organizationId,
  integrations,
  isManager,
  error,
}: {
  organizationId: string
  integrations: OrganizationIntegration[]
  isManager: boolean
  error?: string
}) {
  const byProvider = new Map(integrations.map((i) => [i.provider, i]))

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm">{error}</div>}

      {PROVIDERS.map((p) => {
        const integration = byProvider.get(p.provider)
        const status = integration?.status || 'disconnected'

        return (
          <div key={p.provider} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="font-medium text-[#EDEAF8]">{p.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${getIntegrationStatusColor(status)}`}>{status}</span>
            </div>
            <p className="text-xs text-[#8A88A8] mb-3">{p.description}</p>

            {status === 'connected' ? (
              <div className="flex items-center justify-between text-xs text-[#8A88A8]">
                <span>Connected {formatTimeAgo(integration!.connected_at)}</span>
                {isManager && <DisconnectButton organizationId={organizationId} provider={p.provider} />}
              </div>
            ) : isManager ? (
              <>
                {p.provider === 'gmail' && (
                  <a
                    href={`/api/integrations/gmail/connect?org_id=${organizationId}`}
                    className="inline-block bg-[#6D28D9] hover:bg-[#5B21B6] text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Connect with Google
                  </a>
                )}
                {p.provider === 'hubspot' && (
                  <TokenConnectForm
                    organizationId={organizationId}
                    label="HubSpot"
                    placeholder="Private app access token"
                    helpText="Create a Private App in HubSpot (Settings → Integrations → Private Apps) with crm.objects.contacts scope."
                    helpUrl="https://developers.hubspot.com/docs/api/private-apps"
                    onConnect={(supabase, orgId, token) => connectHubSpot(supabase, orgId, token)}
                  />
                )}
                {p.provider === 'hunter' && (
                  <TokenConnectForm
                    organizationId={organizationId}
                    label="Hunter.io"
                    placeholder="Hunter.io API key"
                    helpText="Free tier available — sign up and copy your API key from account settings."
                    helpUrl="https://hunter.io/api-keys"
                    onConnect={(supabase, orgId, token) => connectHunter(supabase, orgId, token)}
                  />
                )}
                {status === 'error' && integration?.last_error && (
                  <p className="text-xs text-red-400 mt-2">Last error: {integration.last_error}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-[#8A88A8]">Only an organization manager can connect integrations.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

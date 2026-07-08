import { SupabaseClient } from '@supabase/supabase-js'
import { GmailEmailProvider } from './gmail'
import { HubSpotCrmProvider } from './hubspot'
import { HunterProspectProvider } from './hunter'
import { CrmProvider, EmailProvider, IntegrationConfigError, IntegrationProviderName, ProspectProvider } from './types'

export * from './types'

async function getCredentials(supabase: SupabaseClient, organizationId: string, provider: IntegrationProviderName): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('organization_integrations')
    .select('credentials, status')
    .eq('organization_id', organizationId)
    .eq('provider', provider)
    .maybeSingle()

  if (!data || data.status !== 'connected') return null
  return data.credentials as Record<string, unknown>
}

export async function getProspectProvider(supabase: SupabaseClient, organizationId: string): Promise<ProspectProvider> {
  const credentials = await getCredentials(supabase, organizationId, 'hunter')
  if (!credentials) throw new IntegrationConfigError('Hunter.io is not connected for this organization — connect it from the Integrations tab')
  return new HunterProspectProvider(credentials.apiKey as string)
}

export async function getEmailProvider(supabase: SupabaseClient, organizationId: string): Promise<EmailProvider> {
  const credentials = await getCredentials(supabase, organizationId, 'gmail')
  if (!credentials) throw new IntegrationConfigError('Gmail is not connected for this organization — connect it from the Integrations tab')
  return new GmailEmailProvider({ refreshToken: credentials.refreshToken as string, email: credentials.email as string })
}

export async function getCrmProvider(supabase: SupabaseClient, organizationId: string): Promise<CrmProvider> {
  const credentials = await getCredentials(supabase, organizationId, 'hubspot')
  if (!credentials) throw new IntegrationConfigError('HubSpot is not connected for this organization — connect it from the Integrations tab')
  return new HubSpotCrmProvider(credentials.accessToken as string)
}

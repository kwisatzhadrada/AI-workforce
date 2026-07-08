import { CrmContactFields, CrmProvider, IntegrationConfigError } from './types'

const HUBSPOT_API = 'https://api.hubapi.com'

// HubSpot integration via a Private App access token — HubSpot's current
// recommended method for a single-account custom integration (no OAuth
// consent screen needed, unlike the legacy API key). An OAuth app would
// be the natural next step for a multi-account, install-from-marketplace
// product; a pasted token is the right scope for proving this works.
export class HubSpotCrmProvider implements CrmProvider {
  name = 'hubspot' as const

  constructor(private accessToken: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    if (!this.accessToken) {
      throw new IntegrationConfigError('HubSpot is not connected for this organization')
    }

    const res = await fetch(`${HUBSPOT_API}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...(init.headers || {}),
      },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HubSpot request failed (${res.status}) on ${path}: ${body.slice(0, 300)}`)
    }
    if (res.status === 204) return null
    return res.json()
  }

  async findContactByEmail(email: string): Promise<string | null> {
    const result = (await this.request('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        limit: 1,
      }),
    })) as { results?: { id: string }[] }

    return result?.results?.[0]?.id || null
  }

  async createContact(fields: CrmContactFields): Promise<string> {
    const result = (await this.request('/crm/v3/objects/contacts', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          email: fields.email,
          firstname: fields.firstName || undefined,
          lastname: fields.lastName || undefined,
          company: fields.company || undefined,
          jobtitle: fields.jobTitle || undefined,
        },
      }),
    })) as { id: string }

    return result.id
  }

  async updateContact(contactId: string, fields: Partial<CrmContactFields>): Promise<void> {
    const properties: Record<string, string> = {}
    if (fields.firstName) properties.firstname = fields.firstName
    if (fields.lastName) properties.lastname = fields.lastName
    if (fields.company) properties.company = fields.company
    if (fields.jobTitle) properties.jobtitle = fields.jobTitle

    if (Object.keys(properties).length === 0) return

    await this.request(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    })
  }

  async logNote(contactId: string, note: string): Promise<void> {
    const result = (await this.request('/crm/v3/objects/notes', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_note_body: note,
          hs_timestamp: new Date().toISOString(),
        },
      }),
    })) as { id: string }

    await this.request(`/crm/v3/objects/notes/${result.id}/associations/contacts/${contactId}/note_to_contact`, {
      method: 'PUT',
    })
  }
}

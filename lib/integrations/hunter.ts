import { EnrichedCompany, IntegrationConfigError, ProspectContact, ProspectProvider } from './types'

// Hunter.io Domain Search — a real, free-tier API (no OAuth) that turns a
// company domain into real people and verified-pattern email addresses at
// that company. This is the "generate prospects" / "enrich records" leg:
// it does not discover companies matching a target-market description
// (that needs a paid firmographic API like Apollo/Clearbit Discovery,
// swappable in later behind this same interface) — it takes a seed list
// of target company domains and turns each into real contacts.
export class HunterProspectProvider implements ProspectProvider {
  name = 'hunter' as const

  constructor(private apiKey: string) {}

  async enrichDomain(domain: string): Promise<EnrichedCompany> {
    if (!this.apiKey) {
      throw new IntegrationConfigError('Hunter.io is not connected for this organization')
    }

    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(this.apiKey)}&limit=10`
    const res = await fetch(url)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Hunter.io domain search failed for ${domain} (${res.status}): ${body.slice(0, 300)}`)
    }

    const data = await res.json()
    const org = data?.data
    const emails: unknown[] = Array.isArray(org?.emails) ? org.emails : []

    const people: ProspectContact[] = emails
      .map((e): ProspectContact | null => {
        const rec = e as Record<string, unknown>
        const value = rec.value
        if (typeof value !== 'string' || !value) return null
        const firstName = typeof rec.first_name === 'string' ? rec.first_name : ''
        const lastName = typeof rec.last_name === 'string' ? rec.last_name : ''
        const name = [firstName, lastName].filter(Boolean).join(' ') || null
        return {
          name,
          email: value,
          title: typeof rec.position === 'string' ? rec.position : null,
          confidence: typeof rec.confidence === 'number' ? rec.confidence : null,
        }
      })
      .filter((p): p is ProspectContact => p !== null)

    return {
      domain,
      companyName: typeof org?.organization === 'string' ? org.organization : null,
      people,
    }
  }
}

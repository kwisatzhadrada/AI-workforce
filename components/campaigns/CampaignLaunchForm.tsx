'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CampaignLaunchForm({ organizationId, onLaunched }: { organizationId: string; onLaunched?: () => void }) {
  const router = useRouter()
  const [targetIndustry, setTargetIndustry] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [location, setLocation] = useState('')
  const [icpDescription, setIcpDescription] = useState('')
  const [domains, setDomains] = useState('')
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function launch() {
    setLaunching(true)
    setError(null)
    setNotice(null)
    const res = await fetch('/api/campaigns/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        target_industry: targetIndustry,
        company_size: companySize,
        location,
        icp_description: icpDescription,
        domains: domains || undefined,
      }),
    })
    const body = await res.json().catch(() => ({}))
    setLaunching(false)
    if (!res.ok) { setError(body.error || 'Could not launch campaign'); return }
    setNotice(
      body.domainsSource === 'ai_suggested'
        ? `Campaign launched with ${body.domains.length} AI-suggested candidate domains — review them on the Research step before trusting the results.`
        : `Campaign launched with ${body.domains.length} target domain(s).`
    )
    // router.refresh() re-fetches this route's server data, which is
    // enough when this form renders on the organization page — but
    // /onboarding wraps this in a client component with its own local
    // state (so a Gmail OAuth redirect doesn't lose progress), and
    // router.refresh() alone doesn't reach that state. onLaunched lets
    // the parent re-fetch its own view of the campaign explicitly.
    router.refresh()
    onLaunched?.()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="font-['Space_Grotesk'] font-bold text-lg">Launch your first campaign</h2>
        <p className="text-[#8A88A8] text-sm mt-1">
          Describe who you&apos;re selling to. The workforce finds and enriches real prospects, drafts outreach, and
          waits for your approval before anything sends.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#8A88A8] block mb-1">Target Industry</label>
          <input
            value={targetIndustry}
            onChange={(e) => setTargetIndustry(e.target.value)}
            placeholder="e.g. Fintech"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
          />
        </div>
        <div>
          <label className="text-xs text-[#8A88A8] block mb-1">Company Size</label>
          <select
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
          >
            <option value="">Any</option>
            <option value="1-10 employees">1-10 employees</option>
            <option value="11-50 employees">11-50 employees</option>
            <option value="51-200 employees">51-200 employees</option>
            <option value="201-1000 employees">201-1000 employees</option>
            <option value="1000+ employees">1000+ employees</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-[#8A88A8] block mb-1">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. United States"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-[#8A88A8] block mb-1">Ideal Customer Profile Description</label>
          <textarea
            value={icpDescription}
            onChange={(e) => setIcpDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Series A-C fintech companies building payments infrastructure, whose engineering leaders care about developer experience."
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-[#8A88A8] block mb-1">
            Know specific companies? Paste their domains (optional — comma or newline separated)
          </label>
          <textarea
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            rows={2}
            placeholder="acme.com, beta.io"
            className="w-full bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
          />
          <p className="text-xs text-[#8A88A8] mt-1">
            If left blank, an AI will suggest candidate domains from the fields above — clearly labeled as
            unverified suggestions, since this platform&apos;s prospect data provider (Hunter.io) enriches known
            domains, it doesn&apos;t discover companies from a description on its own.
          </p>
        </div>
      </div>

      <button
        onClick={launch}
        disabled={launching}
        className="bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium"
      >
        {launching ? 'Launching...' : 'Launch Campaign'}
      </button>

      {notice && <div className="text-xs text-green-400">{notice}</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}

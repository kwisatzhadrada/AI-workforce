'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type OrgOption = { id: string; name: string }

export default function ExecutionViewControls({ myOrgs }: { myOrgs: OrgOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') || 'mine'
  const orgId = searchParams.get('org_id') || ''

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Link href="/executions?view=mine" className={`px-3 py-1.5 rounded-lg text-sm border ${view === 'mine' ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'}`}>
        My Agents
      </Link>
      <Link href="/executions?view=organization" className={`px-3 py-1.5 rounded-lg text-sm border ${view === 'organization' ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'}`}>
        Organization
      </Link>
      {view === 'organization' && (
        <select
          value={orgId}
          className="bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#6D28D9]"
          onChange={(e) => router.push(`/executions?view=organization&org_id=${e.target.value}`)}
        >
          <option value="">Choose an organization…</option>
          {myOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
    </div>
  )
}

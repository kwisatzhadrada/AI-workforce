'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type OrgOption = { id: string; name: string }

export default function GoalQueueControls({ myOrgs }: { myOrgs: OrgOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const selectCls = 'bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]'

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <select className={selectCls} value={searchParams.get('org_id') || ''} onChange={(e) => update({ org_id: e.target.value || null })}>
        <option value="">Choose an organization…</option>
        {myOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select className={selectCls} value={searchParams.get('status') || ''} onChange={(e) => update({ status: e.target.value || null })}>
        <option value="">Any status</option>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>
    </div>
  )
}

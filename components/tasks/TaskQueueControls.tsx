'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { OrganizationDepartment } from '@/lib/types'

type OrgOption = { id: string; name: string }

const VIEWS = [
  { value: 'mine', label: 'My Tasks' },
  { value: 'organization', label: 'Organization Tasks' },
  { value: 'department', label: 'Department Tasks' },
] as const

type AgentOption = { id: string; name: string }

export default function TaskQueueControls({
  myOrgs,
  departments,
  agentOptions,
}: {
  myOrgs: OrgOption[]
  departments: OrganizationDepartment[]
  agentOptions: AgentOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') || 'mine'

  function update(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const selectCls = 'bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]'

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            onClick={() => update({ view: v.value, org_id: v.value === 'mine' ? null : searchParams.get('org_id'), department_id: v.value !== 'department' ? null : searchParams.get('department_id') })}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              view === v.value ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {view !== 'mine' && (
          <select className={selectCls} value={searchParams.get('org_id') || ''} onChange={(e) => update({ org_id: e.target.value || null, department_id: null })}>
            <option value="">Choose an organization…</option>
            {myOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        {view === 'department' && searchParams.get('org_id') && (
          <select className={selectCls} value={searchParams.get('department_id') || ''} onChange={(e) => update({ department_id: e.target.value || null })}>
            <option value="">Choose a department…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <select className={selectCls} value={searchParams.get('status') || ''} onChange={(e) => update({ status: e.target.value || null })}>
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select className={selectCls} value={searchParams.get('priority') || ''} onChange={(e) => update({ priority: e.target.value || null })}>
          <option value="">Any priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        {agentOptions.length > 0 && (
          <select className={selectCls} value={searchParams.get('agent_id') || ''} onChange={(e) => update({ agent_id: e.target.value || null })}>
            <option value="">Any agent</option>
            {agentOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

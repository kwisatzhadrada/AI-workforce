import Link from 'next/link'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'departments', label: 'Departments' },
  { value: 'agents', label: 'Agents' },
  { value: 'performance', label: 'Performance' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'workflows', label: 'Workflows' },
  { value: 'activity', label: 'Activity' },
] as const

export default function OrgTabs({ orgId, active }: { orgId: string; active: string }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={`/organizations/${orgId}?tab=${t.value}`}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            active === t.value
              ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
              : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'

// The tabs a customer actually cares about — "I launched a campaign and
// got meetings," not "I deployed an autonomous workforce architecture."
const PRIMARY_TABS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'reports', label: 'Reports' },
  { value: 'integrations', label: 'Integrations' },
] as const

// Real, still fully functional — just not competing for attention on
// every visit. Collapsed behind one toggle, same pattern the nav's
// Workspace/Admin dropdowns already use.
const ADVANCED_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'departments', label: 'Departments' },
  { value: 'agents', label: 'Agents' },
  { value: 'performance', label: 'Performance' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'workflows', label: 'Workflows' },
  { value: 'activity', label: 'Activity' },
  { value: 'setup', label: 'Setup Wizard' },
] as const

const ALL_TABS = [...PRIMARY_TABS, ...ADVANCED_TABS]

function TabLink({ orgId, value, label, active }: { orgId: string; value: string; label: string; active: boolean }) {
  return (
    <Link
      href={`/organizations/${orgId}?tab=${value}`}
      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
        active ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'
      }`}
    >
      {label}
    </Link>
  )
}

export default function OrgTabs({ orgId, active }: { orgId: string; active: string }) {
  const activeIsAdvanced = ADVANCED_TABS.some((t) => t.value === active)
  const [showAdvanced, setShowAdvanced] = useState(activeIsAdvanced)

  return (
    <div className="no-print mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {PRIMARY_TABS.map((t) => <TabLink key={t.value} orgId={orgId} value={t.value} label={t.label} active={active === t.value} />)}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            activeIsAdvanced ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'
          }`}
        >
          Advanced {showAdvanced ? '▲' : '▼'}
        </button>
      </div>
      {showAdvanced && (
        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-[#3C3A58]/20">
          {ADVANCED_TABS.map((t) => <TabLink key={t.value} orgId={orgId} value={t.value} label={t.label} active={active === t.value} />)}
        </div>
      )}
    </div>
  )
}

export const VALID_ORG_TABS = ALL_TABS.map((t) => t.value)

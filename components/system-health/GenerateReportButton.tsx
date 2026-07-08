'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateSystemReport } from '@/lib/simulation'
import { ReportType } from '@/lib/types'

export default function GenerateReportButton({ reportType }: { reportType: ReportType }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setSaving(true)
    setError(null)
    const { error } = await generateSystemReport(supabase, reportType)
    setSaving(false)
    if (error) { setError(error); return }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        onClick={generate}
        disabled={saving}
        className="bg-[#121428] border border-[#3C3A58] hover:border-[#6D28D9] disabled:opacity-50 text-[#EDEAF8] px-3 py-1.5 rounded-lg text-sm font-medium capitalize"
      >
        {saving ? 'Generating...' : `Generate ${reportType} Report`}
      </button>
    </div>
  )
}

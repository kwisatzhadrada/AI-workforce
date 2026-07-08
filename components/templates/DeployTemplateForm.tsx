'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deployTemplate } from '@/lib/templates'

export default function DeployTemplateForm({ templateId, templateName, defaultIndustry }: { templateId: string; templateName: string; defaultIndustry: string | null }) {
  const supabase = createClient()
  const router = useRouter()
  const [orgName, setOrgName] = useState(templateName)
  const [industry, setIndustry] = useState(defaultIndustry || '')
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-3 outline-none transition-colors'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) {
      setError('Organization name is required.')
      return
    }
    setDeploying(true)
    setError(null)
    const { organizationId, error } = await deployTemplate(supabase, templateId, orgName, industry || undefined)
    setDeploying(false)
    if (error) { setError(error); return }
    router.push(`/organizations/${organizationId}`)
  }

  return (
    <div className="bg-[#0C0D22] border border-[#6D28D9]/40 rounded-2xl p-6">
      <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-1">Deploy this Team</h2>
      <p className="text-xs text-[#8A88A8] mb-4">Creates a new organization with its departments, agents, capabilities, workflow, and goals already in place.</p>

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Organization name</label>
          <input className={inputCls} maxLength={100} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Industry</label>
          <input className={inputCls} maxLength={100} value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <button type="submit" disabled={deploying} className="w-full bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white py-3 rounded-xl font-semibold">
          {deploying ? 'Deploying...' : '🚀 Deploy Organization'}
        </button>
      </form>
    </div>
  )
}

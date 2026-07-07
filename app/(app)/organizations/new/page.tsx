'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewOrganizationPage() {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-3 outline-none transition-colors'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7)

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        slug,
        description: description.trim() || null,
        industry: industry.trim() || null,
        website_url: websiteUrl.trim() || null,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    setSaving(false)
    router.push(`/organizations/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Create an Organization</h1>
        <p className="text-[#8A88A8] text-sm mt-1">
          You&apos;ll get the standard departments (Sales, Marketing, Research, Operations, Support, Finance, Development) automatically.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">{error}</div>
      )}

      <form onSubmit={submit} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Organization name *</label>
          <input className={inputCls} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme AI Workforce" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Description</label>
          <textarea className={`${inputCls} resize-none`} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this organization do?" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Industry</label>
          <input className={inputCls} maxLength={100} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Fintech, Healthcare, SaaS" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Website</label>
          <input className={inputCls} maxLength={300} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
        >
          {saving ? 'Creating...' : 'Create Organization 🏢'}
        </button>
      </form>
    </div>
  )
}

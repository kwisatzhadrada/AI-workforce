'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewAgentPage() {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [skillsInput, setSkillsInput] = useState('')
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

    const skills = skillsInput.split(',').map((s) => s.trim()).filter(Boolean)

    const { data, error } = await supabase
      .from('agents')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        skills,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    setSaving(false)
    router.push(`/agent/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Register an Agent</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Give your AI worker an identity — a wallet and performance tracking are created automatically.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">{error}</div>
      )}

      <form onSubmit={submit} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Agent name *</label>
          <input className={inputCls} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Research Analyst v2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Description</label>
          <textarea className={`${inputCls} resize-none`} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this agent do?" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Skills</label>
          <input className={inputCls} maxLength={500} value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="web-search, data-analysis, python" />
          <p className="text-xs text-[#8A88A8] mt-1">Comma-separated.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
        >
          {saving ? 'Registering...' : 'Register Agent 🤖'}
        </button>
      </form>
    </div>
  )
}

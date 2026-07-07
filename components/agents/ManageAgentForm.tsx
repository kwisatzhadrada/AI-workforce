'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Agent, AgentCredential, AgentStatus } from '@/lib/types'

export default function ManageAgentForm({ agent, credentials }: { agent: Agent; credentials: AgentCredential[] }) {
  const supabase = createClient()
  const router = useRouter()

  const [description, setDescription] = useState(agent.description ?? '')
  const [skillsInput, setSkillsInput] = useState(agent.skills.join(', '))
  const [status, setStatus] = useState<AgentStatus>(agent.status)
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const [credTitle, setCredTitle] = useState('')
  const [credIssuer, setCredIssuer] = useState('')
  const [credUrl, setCredUrl] = useState('')
  const [savingCred, setSavingCred] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)

  const inputCls = 'w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-3 py-2 outline-none transition-colors text-sm'

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    setSavingDetails(true)
    setDetailsError(null)
    const skills = skillsInput.split(',').map((s) => s.trim()).filter(Boolean)
    const { error } = await supabase
      .from('agents')
      .update({ description: description.trim() || null, skills, status })
      .eq('id', agent.id)
    setSavingDetails(false)
    if (error) { setDetailsError(error.message); return }
    router.refresh()
  }

  async function addCredential(e: React.FormEvent) {
    e.preventDefault()
    if (!credTitle.trim()) {
      setCredError('Title is required.')
      return
    }
    setSavingCred(true)
    setCredError(null)
    const { error } = await supabase.from('agent_credentials').insert({
      agent_id: agent.id,
      title: credTitle.trim(),
      issuer: credIssuer.trim() || null,
      credential_url: credUrl.trim() || null,
    })
    setSavingCred(false)
    if (error) { setCredError(error.message); return }
    setCredTitle('')
    setCredIssuer('')
    setCredUrl('')
    router.refresh()
  }

  async function removeCredential(id: string) {
    await supabase.from('agent_credentials').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Identity</h2>
        {detailsError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{detailsError}</div>}
        <form onSubmit={saveDetails} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Skills</label>
            <input className={inputCls} maxLength={500} value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="web-search, data-analysis, python" />
            <p className="text-xs text-[#8A88A8] mt-1">Comma-separated.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Status</label>
            <div className="flex gap-2">
              {(['active', 'inactive', 'suspended'] as AgentStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    status === s ? 'bg-[#6D28D9] border-[#6D28D9] text-white' : 'bg-[#121428] border-[#3C3A58] text-[#8A88A8] hover:border-[#6D28D9]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={savingDetails} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            {savingDetails ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-4">Credentials</h2>

        {credentials.length > 0 && (
          <div className="space-y-2 mb-5">
            {credentials.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-[#121428] rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm text-[#EDEAF8]">{c.title}</div>
                  {c.issuer && <div className="text-xs text-[#8A88A8]">{c.issuer}</div>}
                </div>
                <button onClick={() => removeCredential(c.id)} className="text-xs text-[#8A88A8] hover:text-red-400">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {credError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 mb-4 text-sm">{credError}</div>}
        <form onSubmit={addCredential} className="space-y-3">
          <input className={inputCls} maxLength={200} value={credTitle} onChange={(e) => setCredTitle(e.target.value)} placeholder="Credential title (e.g. SOC 2 Attestation)" />
          <input className={inputCls} maxLength={200} value={credIssuer} onChange={(e) => setCredIssuer(e.target.value)} placeholder="Issuer (optional)" />
          <input className={inputCls} maxLength={500} value={credUrl} onChange={(e) => setCredUrl(e.target.value)} placeholder="Credential URL (optional)" />
          <button type="submit" disabled={savingCred} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            {savingCred ? 'Adding...' : '+ Add Credential'}
          </button>
        </form>
      </div>
    </div>
  )
}

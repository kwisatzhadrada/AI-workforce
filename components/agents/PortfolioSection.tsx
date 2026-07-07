'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addAgentProject } from '@/lib/registry'
import { AgentProject } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'

export default function PortfolioSection({
  agentId,
  projects,
  isOwner,
}: {
  agentId: string
  projects: AgentProject[]
  isOwner: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [results, setResults] = useState('')
  const [proofLinksInput, setProofLinksInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full bg-[#0C0D22] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-lg px-3 py-2 outline-none text-sm'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError(null)
    const proofLinks = proofLinksInput.split(',').map((s) => s.trim()).filter(Boolean)
    const { error } = await addAgentProject(supabase, agentId, { title, description, results, proofLinks })
    setSaving(false)
    if (error) { setError(error); return }
    setTitle('')
    setDescription('')
    setResults('')
    setProofLinksInput('')
    setShowForm(false)
    router.refresh()
  }

  return (
    <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-['Space_Grotesk'] font-bold text-lg">Portfolio</h2>
        {isOwner && (
          <button onClick={() => setShowForm((s) => !s)} className="text-sm text-[#8B5CF6] hover:text-[#6D28D9]">
            {showForm ? 'Cancel' : '+ Add Project'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-[#121428] rounded-xl p-4 space-y-3 mb-4">
          {error && <div className="text-red-400 text-xs">{error}</div>}
          <input className={inputCls} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" />
          <textarea className={`${inputCls} resize-none`} rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <textarea className={`${inputCls} resize-none`} rows={2} maxLength={2000} value={results} onChange={(e) => setResults(e.target.value)} placeholder="Results / outcomes / metrics" />
          <input className={inputCls} maxLength={1000} value={proofLinksInput} onChange={(e) => setProofLinksInput(e.target.value)} placeholder="Proof links (comma-separated URLs)" />
          <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {saving ? 'Saving...' : 'Add Project'}
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="text-sm text-[#8A88A8]">No projects showcased yet.</div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="bg-[#121428] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm text-[#EDEAF8]">{p.title}</div>
                <div className="text-xs text-[#8A88A8]">{formatTimeAgo(p.created_at)}</div>
              </div>
              {p.description && <p className="text-sm text-[#8A88A8] mb-2">{p.description}</p>}
              {p.results && (
                <div className="bg-[#0C0D22] rounded-lg p-2 mb-2">
                  <div className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1">Results</div>
                  <p className="text-sm text-[#EDEAF8]">{p.results}</p>
                </div>
              )}
              {p.proof_links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.proof_links.map((link) => (
                    <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#8B5CF6] hover:underline">
                      {link}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

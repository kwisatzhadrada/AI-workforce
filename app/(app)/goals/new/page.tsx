'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createGoal } from '@/lib/goals'
import { TaskPriority } from '@/lib/types'

type Option = { id: string; name: string }

function NewGoalForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialOrgId = searchParams.get('org_id') || ''

  const [orgs, setOrgs] = useState<Option[]>([])
  const [agents, setAgents] = useState<Option[]>([])
  const [organizationId, setOrganizationId] = useState(initialOrgId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [deadline, setDeadline] = useState('')
  const [managerAgentId, setManagerAgentId] = useState('')
  const [metricKeys, setMetricKeys] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-3 outline-none transition-colors'

  useEffect(() => {
    async function loadOrgs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('organization_members').select('organizations(id, name)').eq('user_id', user.id)
      const unique = Array.from(
        new Map(((data || []) as unknown as { organizations: Option | null }[])
          .filter((m) => m.organizations)
          .map((m) => [m.organizations!.id, m.organizations!])
        ).values()
      )
      setOrgs(unique)
    }
    loadOrgs()
  }, [supabase])

  useEffect(() => {
    if (!organizationId) { setAgents([]); return }
    async function loadAgents() {
      const { data } = await supabase.from('agent_assignments').select('agents(id, name)').eq('organization_id', organizationId).eq('status', 'active')
      const unique = Array.from(
        new Map(((data || []) as unknown as { agents: Option | null }[])
          .filter((r) => r.agents)
          .map((r) => [r.agents!.id, r.agents!])
        ).values()
      )
      setAgents(unique)
    }
    loadAgents()
  }, [organizationId, supabase])

  function parseTargetMetrics(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    metricKeys.split(',').forEach((pair) => {
      const [k, v] = pair.split(':').map((s) => s.trim())
      if (k && v) result[k] = isNaN(Number(v)) ? v : Number(v)
    })
    return result
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId || !title.trim()) {
      setError('Organization and title are required.')
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { id, error } = await createGoal(supabase, {
      organizationId,
      createdBy: user.id,
      title,
      description,
      priority,
      targetMetrics: parseTargetMetrics(),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      managerAgentId: managerAgentId || null,
    })

    setSaving(false)
    if (error) { setError(error); return }
    router.push(`/goals/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Create a Goal</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Describe the outcome — planning and task generation come next.</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">{error}</div>}

      <form onSubmit={submit} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Organization *</label>
          <select className={inputCls} value={organizationId} onChange={(e) => { setOrganizationId(e.target.value); setManagerAgentId('') }}>
            <option value="">Choose an organization…</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Title *</label>
          <input className={inputCls} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Generate 100 qualified leads" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Description</label>
          <textarea className={`${inputCls} resize-none`} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does success look like?" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Priority</label>
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Deadline</label>
            <input type="datetime-local" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Manager agent</label>
          <select className={inputCls} value={managerAgentId} onChange={(e) => setManagerAgentId(e.target.value)} disabled={!organizationId}>
            <option value="">None yet (set later)</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <p className="text-xs text-[#8A88A8] mt-1">The agent that autonomously drives this goal's plan — required before it can run on its own.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Target metrics</label>
          <input className={inputCls} value={metricKeys} onChange={(e) => setMetricKeys(e.target.value)} placeholder="leads: 100, conversion_rate: 5" />
          <p className="text-xs text-[#8A88A8] mt-1">Comma-separated key: value pairs.</p>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white py-3 rounded-xl font-semibold">
          {saving ? 'Creating...' : 'Create Goal 🎯'}
        </button>
      </form>
    </div>
  )
}

export default function NewGoalPage() {
  return (
    <Suspense>
      <NewGoalForm />
    </Suspense>
  )
}

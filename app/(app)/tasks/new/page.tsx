'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createTask } from '@/lib/tasks'
import { TaskPriority } from '@/lib/types'

type Option = { id: string; name: string }

export default function NewTaskPage() {
  const supabase = createClient()
  const router = useRouter()

  const [orgs, setOrgs] = useState<Option[]>([])
  const [departments, setDepartments] = useState<Option[]>([])
  const [agents, setAgents] = useState<Option[]>([])

  const [organizationId, setOrganizationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [assignedAgentId, setAssignedAgentId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!organizationId) { setDepartments([]); setAgents([]); return }
    async function loadOrgScoped() {
      const [{ data: depts }, { data: assigned }] = await Promise.all([
        supabase.from('organization_departments').select('id, name').eq('organization_id', organizationId).order('name'),
        supabase.from('agent_assignments').select('agents(id, name)').eq('organization_id', organizationId).eq('status', 'active'),
      ])
      setDepartments(depts || [])
      const unique = Array.from(
        new Map(((assigned || []) as unknown as { agents: Option | null }[])
          .filter((r) => r.agents)
          .map((r) => [r.agents!.id, r.agents!])
        ).values()
      )
      setAgents(unique)
    }
    loadOrgScoped()
  }, [organizationId, supabase])

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

    const { id, error } = await createTask(supabase, {
      organizationId,
      departmentId: departmentId || null,
      assignedAgentId: assignedAgentId || null,
      createdBy: user.id,
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    })

    setSaving(false)
    if (error) { setError(error); return }
    router.push(`/tasks/${id}`)
  }

  const inputCls = 'w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-3 outline-none transition-colors'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Create a Task</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Assign work to an agent — or leave it unassigned for now.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">{error}</div>
      )}

      <form onSubmit={submit} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Organization *</label>
          <select className={inputCls} value={organizationId} onChange={(e) => { setOrganizationId(e.target.value); setDepartmentId(''); setAssignedAgentId('') }}>
            <option value="">Choose an organization…</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Title *</label>
          <input className={inputCls} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Qualify inbound lead from acme.com" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Description</label>
          <textarea className={`${inputCls} resize-none`} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to get done?" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Department</label>
            <select className={inputCls} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={!organizationId}>
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Assign to agent</label>
            <select className={inputCls} value={assignedAgentId} onChange={(e) => setAssignedAgentId(e.target.value)} disabled={!organizationId}>
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
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
            <label className="block text-sm font-medium text-[#8A88A8] mb-1.5">Due date</label>
            <input type="datetime-local" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
        >
          {saving ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  )
}

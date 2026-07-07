'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { assignAgent, updateAssignment } from '@/lib/organizations'
import { AgentAssignment, AssignmentPriority, OrganizationDepartment } from '@/lib/types'
import { getAssignmentPriorityColor, getAssignmentStatusColor, getAgentStatusColor, getInitials } from '@/lib/utils'

export default function AgentAssignmentsPanel({
  organizationId,
  assignments,
  departments,
  myAgents,
  isManager,
  currentUserId,
}: {
  organizationId: string
  assignments: AgentAssignment[]
  departments: OrganizationDepartment[]
  myAgents: { id: string; name: string }[]
  isManager: boolean
  currentUserId: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [agentId, setAgentId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [priority, setPriority] = useState<AssignmentPriority>('medium')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!agentId) {
      setError('Choose one of your agents.')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await assignAgent(supabase, {
      agentId,
      organizationId,
      departmentId: departmentId || null,
      priority,
      assignedBy: currentUserId,
    })
    setSaving(false)
    if (error) { setError(error); return }
    setAgentId('')
    setDepartmentId('')
    setPriority('medium')
    router.refresh()
  }

  async function changeStatus(assignmentId: string, status: string) {
    setBusyId(assignmentId)
    await updateAssignment(supabase, assignmentId, { status })
    setBusyId(null)
    router.refresh()
  }

  const selectCls = 'bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]'

  return (
    <div>
      {isManager && myAgents.length > 0 && (
        <form onSubmit={submit} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-2xl p-4 mb-5 flex flex-wrap gap-2 items-end">
          <select className={selectCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Choose one of your agents…</option>
            {myAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className={selectCls} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value as AssignmentPriority)}>
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
            <option value="critical">Critical priority</option>
          </select>
          <button type="submit" disabled={saving} className="bg-[#6D28D9] hover:bg-[#8B5CF6] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium">
            {saving ? 'Assigning...' : '+ Assign Agent'}
          </button>
        </form>
      )}
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

      {assignments.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-16">No agents assigned yet.</div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#6D28D9] flex items-center justify-center text-sm font-semibold text-white shrink-0">
                {getInitials(a.agents?.name || null)}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/agent/${a.agent_id}`} className="font-medium text-sm text-[#EDEAF8] hover:underline">
                  {a.agents?.name || 'Unknown agent'}
                </Link>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {a.organization_departments && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-[#121428] border border-[#3C3A58] text-[#8A88A8]">
                      {a.organization_departments.name}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-md border ${getAssignmentPriorityColor(a.priority)}`}>{a.priority}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md border ${getAssignmentStatusColor(a.status)}`}>{a.status}</span>
                  {a.agents?.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-md border ${getAgentStatusColor(a.agents.status)}`}>agent: {a.agents.status}</span>
                  )}
                </div>
              </div>
              {isManager && a.status !== 'completed' && a.status !== 'removed' && (
                <div className="flex gap-2 shrink-0">
                  {a.status === 'active' && (
                    <button
                      disabled={busyId === a.id}
                      onClick={() => changeStatus(a.id, 'completed')}
                      className="text-xs text-green-400 hover:text-green-300 border border-green-500/20 bg-green-500/10 px-2 py-1 rounded-lg disabled:opacity-50"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    disabled={busyId === a.id}
                    onClick={() => changeStatus(a.id, 'removed')}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 bg-red-500/10 px-2 py-1 rounded-lg disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

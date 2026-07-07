import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { OrganizationDepartment, Task } from '@/lib/types'
import TaskQueueControls from '@/components/tasks/TaskQueueControls'
import TaskCard from '@/components/tasks/TaskCard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const TASK_SELECT = '*, organizations(id, name), organization_departments(id, name), agents(id, name, avatar_url, owner_id)'

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : v
  }

  const view = get('view') || 'mine'
  const orgId = get('org_id') || ''
  const departmentId = get('department_id') || ''
  const status = get('status') || ''
  const priority = get('priority') || ''
  const agentId = get('agent_id') || ''
  const page = Math.max(1, Number(get('page')) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const [{ data: myOrgMemberships }, { data: myAgents }] = await Promise.all([
    supabase.from('organization_members').select('organizations(id, name)').eq('user_id', user.id),
    supabase.from('agents').select('id, name').eq('owner_id', user.id).order('name'),
  ])

  const myOrgs = Array.from(
    new Map(((myOrgMemberships || []) as unknown as { organizations: { id: string; name: string } | null }[])
      .filter((m) => m.organizations)
      .map((m) => [m.organizations!.id, m.organizations!])
    ).values()
  )

  const departments = orgId
    ? ((await supabase.from('organization_departments').select('*').eq('organization_id', orgId).order('name')).data as OrganizationDepartment[] || [])
    : []

  let agentOptions: { id: string; name: string }[] = myAgents || []
  let query = supabase.from('tasks').select(TASK_SELECT, { count: 'exact' })
  let ready = true

  if (view === 'organization') {
    if (!orgId) {
      ready = false
    } else {
      query = query.eq('organization_id', orgId)
      const { data: assigned } = await supabase.from('agent_assignments').select('agents(id, name)').eq('organization_id', orgId).eq('status', 'active')
      agentOptions = Array.from(
        new Map(((assigned || []) as unknown as { agents: { id: string; name: string } | null }[])
          .filter((r) => r.agents)
          .map((r) => [r.agents!.id, r.agents!])
        ).values()
      )
    }
  } else if (view === 'department') {
    if (!orgId || !departmentId) {
      ready = false
    } else {
      query = query.eq('organization_id', orgId).eq('department_id', departmentId)
      const { data: assigned } = await supabase.from('agent_assignments').select('agents(id, name)').eq('department_id', departmentId).eq('status', 'active')
      agentOptions = Array.from(
        new Map(((assigned || []) as unknown as { agents: { id: string; name: string } | null }[])
          .filter((r) => r.agents)
          .map((r) => [r.agents!.id, r.agents!])
        ).values()
      )
    }
  } else {
    const myAgentIds = (myAgents || []).map((a) => a.id)
    if (myAgentIds.length > 0) {
      query = query.or(`assigned_agent_id.in.(${myAgentIds.join(',')}),created_by.eq.${user.id}`)
    } else {
      query = query.eq('created_by', user.id)
    }
  }

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (agentId) query = query.eq('assigned_agent_id', agentId)
  if (view !== 'department' && departmentId) query = query.eq('department_id', departmentId)

  let tasks: Task[] = []
  let total = 0
  if (ready) {
    const { data, count } = await query.order('created_at', { ascending: false }).range(from, to)
    tasks = (data as Task[]) || []
    total = count || 0
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Tasks</h1>
          <p className="text-[#8A88A8] text-sm mt-1">The work queue — create, assign, and track execution.</p>
        </div>
        <Link href="/tasks/new" className="bg-[#6D28D9] hover:bg-[#8B5CF6] text-white px-4 py-2 rounded-xl font-medium text-sm">
          + New Task
        </Link>
      </div>

      <TaskQueueControls myOrgs={myOrgs} departments={departments} agentOptions={agentOptions} />

      {!ready ? (
        <div className="text-center text-[#8A88A8] py-16">
          {view === 'organization' ? 'Choose an organization to see its tasks.' : 'Choose an organization and department to see its tasks.'}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-16">No tasks match this view.</div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {ready && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-[#8A88A8]">Page {page} of {totalPages} · {total.toLocaleString()} tasks</span>
        </div>
      )}
    </div>
  )
}

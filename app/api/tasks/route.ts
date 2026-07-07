import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTask } from '@/lib/tasks'
import { TaskPriority } from '@/lib/types'

const TASK_SELECT = '*, organizations(id, name), organization_departments(id, name), agents(id, name, avatar_url, owner_id)'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const organizationId = params.get('organization_id')
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.get('page_size')) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.from('tasks').select(TASK_SELECT, { count: 'exact' }).eq('organization_id', organizationId)

  const departmentId = params.get('department_id')
  const status = params.get('status')
  const priority = params.get('priority')
  const agentId = params.get('agent_id')
  if (departmentId) query = query.eq('department_id', departmentId)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (agentId) query = query.eq('assigned_agent_id', agentId)

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ tasks: data, total: count || 0, page, pageSize })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.organization_id || !body?.title) {
    return NextResponse.json({ error: 'organization_id and title are required' }, { status: 400 })
  }

  const { id, error } = await createTask(supabase, {
    organizationId: body.organization_id,
    departmentId: body.department_id || null,
    assignedAgentId: body.assigned_agent_id || null,
    createdBy: user.id,
    title: body.title,
    description: body.description,
    priority: body.priority as TaskPriority | undefined,
    dueDate: body.due_date || null,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ id }, { status: 201 })
}

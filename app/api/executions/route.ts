import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgentExecution } from '@/lib/runtime/execute'
import { ModelProviderName } from '@/lib/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const agentId = params.get('agent_id')
  const taskId = params.get('task_id')
  const status = params.get('status')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.get('page_size')) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('agent_executions')
    .select('*, agents(id, name, avatar_url, owner_id), tasks(id, title), agent_capabilities(id, name)', { count: 'exact' })

  if (agentId) query = query.eq('agent_id', agentId)
  if (taskId) query = query.eq('task_id', taskId)
  if (status) query = query.eq('status', status)

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ executions: data, total: count || 0, page, pageSize })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.agent_id) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
  }

  const { execution, error } = await runAgentExecution(supabase, {
    agentId: body.agent_id,
    createdBy: user.id,
    taskId: body.task_id || null,
    capabilityId: body.capability_id || null,
    provider: body.provider as ModelProviderName | undefined,
    input: body.input || {},
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ execution }, { status: 201 })
}

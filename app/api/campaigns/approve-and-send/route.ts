import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendApprovedOutreach } from '@/lib/runtime/campaignActions'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.organization_id || !body?.task_id || !body?.agent_id) {
    return NextResponse.json({ error: 'organization_id, task_id, and agent_id are required' }, { status: 400 })
  }

  const { data: approved, error: approveError } = await supabase.rpc('approve_task_output', { p_task_id: body.task_id })
  if (approveError) {
    return NextResponse.json({ error: approveError.message }, { status: 400 })
  }

  const { result, error } = await sendApprovedOutreach(supabase, {
    organizationId: body.organization_id,
    agentId: body.agent_id,
    taskId: body.task_id,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ approved, result }, { status: 200 })
}

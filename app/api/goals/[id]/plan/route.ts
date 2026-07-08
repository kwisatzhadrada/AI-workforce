import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateGoalPlan } from '@/lib/runtime/plan'
import { ModelProviderName } from '@/lib/types'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: goal } = await supabase.from('organization_goals').select('organization_id').eq('id', id).maybeSingle()
  if (!goal) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  const { data: isSupervisor } = await supabase.rpc('is_org_supervisor', { p_org_id: goal.organization_id, p_user_id: user.id })
  if (!isSupervisor) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))

  const { planId, error } = await generateGoalPlan(supabase, {
    goalId: id,
    createdBy: user.id,
    provider: body.provider as ModelProviderName | undefined,
  })

  if (error) {
    return NextResponse.json({ error, planId }, { status: planId ? 207 : 400 })
  }

  return NextResponse.json({ planId }, { status: 201 })
}

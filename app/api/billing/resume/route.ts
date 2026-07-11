import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

// Undoes a pending cancel_at_period_end — lets someone who cancelled
// change their mind before the period actually ends.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const organizationId = body?.organization_id
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const { data: isManager } = await supabase.rpc('is_org_manager', { p_org_id: organizationId, p_user_id: user.id })
  if (!isManager) {
    return NextResponse.json({ error: 'Only an organization manager can resume a subscription' }, { status: 403 })
  }

  const { data: sub } = await supabase.from('organization_subscriptions').select('stripe_subscription_id').eq('organization_id', organizationId).maybeSingle()
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No subscription to resume' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not resume subscription' }, { status: 500 })
  }
}

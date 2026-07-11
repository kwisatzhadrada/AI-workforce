import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

// Cancels at the end of the current billing period, not immediately —
// the standard, customer-friendly default (they keep access through what
// they already paid for). The DB row itself is updated by the
// customer.subscription.updated webhook once Stripe confirms the change,
// not here directly.
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
    return NextResponse.json({ error: 'Only an organization manager can cancel a subscription' }, { status: 403 })
  }

  const { data: sub } = await supabase.from('organization_subscriptions').select('stripe_subscription_id').eq('organization_id', organizationId).maybeSingle()
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not cancel subscription' }, { status: 500 })
  }
}

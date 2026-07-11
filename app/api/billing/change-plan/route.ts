import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, priceIdForPlan, BillingPlan } from '@/lib/stripe'

// Upgrade/downgrade for an already-subscribed organization. Uses Stripe's
// own proration (the industry-standard behavior: switching mid-cycle
// charges/credits the difference automatically) rather than hand-rolling
// proration math.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const organizationId = body?.organization_id
  const plan = body?.plan as BillingPlan
  if (!organizationId || (plan !== 'standard' && plan !== 'growth')) {
    return NextResponse.json({ error: 'organization_id and a valid plan ("standard" or "growth") are required' }, { status: 400 })
  }

  const { data: isManager } = await supabase.rpc('is_org_manager', { p_org_id: organizationId, p_user_id: user.id })
  if (!isManager) {
    return NextResponse.json({ error: 'Only an organization manager can change plans' }, { status: 403 })
  }

  const { data: sub } = await supabase.from('organization_subscriptions').select('stripe_subscription_id').eq('organization_id', organizationId).maybeSingle()
  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription to change — start one first' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    const currentItemId = subscription.items.data[0]?.id
    if (!currentItemId) {
      return NextResponse.json({ error: 'Could not find the subscription item to change' }, { status: 500 })
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: currentItemId, price: priceIdForPlan(plan) }],
      proration_behavior: 'create_prorations',
      metadata: { ...subscription.metadata, plan },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not change plan' }, { status: 500 })
  }
}

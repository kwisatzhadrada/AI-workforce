import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, priceIdForPlan, BillingPlan } from '@/lib/stripe'
import { siteUrl } from '@/lib/siteUrl'

// Starts a real Stripe Checkout Session for a monthly subscription. This
// is deliberately separate from this platform's own no-card 14-day trial
// (organization_subscriptions.trial_end, started automatically on
// organization creation — see migration 023) — Checkout is for actually
// entering a payment method, whether that happens during or after the
// trial, not a second trial mechanism layered on top of the first.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const organizationId = body?.organization_id
  const plan = (body?.plan as BillingPlan) || 'standard'
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }
  if (plan !== 'standard' && plan !== 'growth') {
    return NextResponse.json({ error: 'plan must be "standard" or "growth"' }, { status: 400 })
  }

  const { data: isManager } = await supabase.rpc('is_org_manager', { p_org_id: organizationId, p_user_id: user.id })
  if (!isManager) {
    return NextResponse.json({ error: 'Only an organization manager can start a subscription' }, { status: 403 })
  }

  const { data: org } = await supabase.from('organizations').select('id, name').eq('id', organizationId).maybeSingle()
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: organizationId,
      customer_email: user.email || undefined,
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      metadata: { organization_id: organizationId, plan },
      subscription_data: { metadata: { organization_id: organizationId, plan } },
      success_url: `${siteUrl()}/organizations/${organizationId}?tab=billing&checkout=success`,
      cancel_url: `${siteUrl()}/organizations/${organizationId}?tab=billing&checkout=cancelled`,
    })
    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not start checkout' }, { status: 500 })
  }
}

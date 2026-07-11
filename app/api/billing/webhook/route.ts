import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { sendAlert } from '@/lib/alerting'

export const dynamic = 'force-dynamic'

// The one place a Stripe event becomes a real row in our schema — every
// other billing route only ever asks Stripe to change something, then
// waits for Stripe to tell us (via here) that it actually happened. Uses
// the same service-role client Phase 21's cron worker uses, for the same
// reason: Stripe calling us has no user session either. Signature
// verification happens before anything else touches the database.
async function upsertFromSubscription(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organization_id
  if (!organizationId) return

  const supabase = createServiceClient()
  const plan = (subscription.metadata?.plan as string) || null
  const item = subscription.items.data[0]
  const currentPeriodEnd = item?.current_period_end
  await supabase.rpc('upsert_subscription_from_stripe_system', {
    p_org_id: organizationId,
    p_stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    p_stripe_subscription_id: subscription.id,
    p_plan: plan,
    p_status: subscription.status,
    p_trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    p_current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
  })
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err instanceof Error ? err.message : 'unknown'}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const organizationId = session.client_reference_id || session.metadata?.organization_id
        if (organizationId && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
          // The Checkout Session's own metadata carries organization_id/plan,
          // but the Subscription object it created only inherits them if
          // subscription_data.metadata was set at creation (it was, in
          // /api/billing/checkout) — this fallback covers the rare case it
          // wasn't, e.g. a subscription created directly in the Stripe dashboard.
          if (!subscription.metadata?.organization_id) {
            await getStripe().subscriptions.update(subscriptionId, { metadata: { organization_id: organizationId, plan: session.metadata?.plan || 'standard' } })
            subscription.metadata = { ...subscription.metadata, organization_id: organizationId, plan: session.metadata?.plan || 'standard' }
          }
          await upsertFromSubscription(subscription)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await upsertFromSubscription(event.data.object as Stripe.Subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await upsertFromSubscription({ ...subscription, status: 'canceled' })
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.parent?.subscription_details?.subscription
        const organizationId = invoice.parent?.subscription_details?.metadata?.organization_id
        const resolvedOrgId = organizationId
          || (subscriptionId
            ? (await getStripe().subscriptions.retrieve(typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id)).metadata?.organization_id
            : null)
        if (resolvedOrgId) {
          const supabase = createServiceClient()
          await supabase.rpc('record_payment_failure_system', { p_org_id: resolvedOrgId })
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler failed'
    await sendAlert('billing_webhook_failed', { eventType: event.type, error: message })
    // Stripe retries on a non-2xx response — surfacing the real error
    // here (rather than swallowing it) is what makes that retry useful.
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}

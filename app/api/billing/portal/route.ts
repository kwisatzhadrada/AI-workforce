import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { siteUrl } from '@/lib/siteUrl'

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
    return NextResponse.json({ error: 'Only an organization manager can manage billing' }, { status: 403 })
  }

  const { data: sub } = await supabase.from('organization_subscriptions').select('stripe_customer_id').eq('organization_id', organizationId).maybeSingle()
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account yet — start a subscription first' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${siteUrl()}/organizations/${organizationId}?tab=billing`,
    })
    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not open billing portal' }, { status: 500 })
  }
}

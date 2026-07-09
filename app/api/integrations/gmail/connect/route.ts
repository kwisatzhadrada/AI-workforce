import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailOAuthUrl } from '@/lib/integrations/gmail'

// Redirects the org manager into Google's real OAuth consent screen.
// Authorization itself is enforced server-side by connect_integration()
// in the callback (is_org_manager) — the org id round-tripped through
// `state` only identifies which org to attach the result to.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const orgId = request.nextUrl.searchParams.get('org_id')
  if (!orgId) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }
  // 'from=onboarding' round-trips through state so the callback can send
  // the user back to the guided onboarding flow instead of the org's
  // Integrations tab — purely a routing hint, same trust model as orgId
  // itself (connect_integration re-checks is_org_manager regardless).
  const from = request.nextUrl.searchParams.get('from')
  const state = from === 'onboarding' ? `${orgId}|onboarding` : orgId

  try {
    const url = getGmailOAuthUrl(state)
    return NextResponse.redirect(url)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gmail is not configured on this deployment'
    return NextResponse.redirect(new URL(`/organizations/${orgId}?tab=integrations&error=${encodeURIComponent(message)}`, request.url))
  }
}

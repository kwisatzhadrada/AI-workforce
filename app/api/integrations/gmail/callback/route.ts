import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeGmailCode } from '@/lib/integrations/gmail'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  const orgId = request.nextUrl.searchParams.get('state')
  const oauthError = request.nextUrl.searchParams.get('error')

  if (!orgId) {
    return NextResponse.json({ error: 'Missing state (organization id)' }, { status: 400 })
  }
  if (oauthError || !code) {
    return NextResponse.redirect(new URL(`/organizations/${orgId}?tab=integrations&error=${encodeURIComponent(oauthError || 'Gmail authorization was cancelled')}`, request.url))
  }

  try {
    const credentials = await exchangeGmailCode(code)
    // connect_integration() re-checks is_org_manager(orgId, auth.uid()) —
    // the org id here is only a routing hint, not a trust boundary.
    const { error } = await supabase.rpc('connect_integration', {
      p_org_id: orgId,
      p_provider: 'gmail',
      p_credentials: { refreshToken: credentials.refreshToken, email: credentials.email },
    })
    if (error) throw new Error(error.message)

    return NextResponse.redirect(new URL(`/organizations/${orgId}?tab=integrations&connected=gmail`, request.url))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect Gmail'
    return NextResponse.redirect(new URL(`/organizations/${orgId}?tab=integrations&error=${encodeURIComponent(message)}`, request.url))
  }
}

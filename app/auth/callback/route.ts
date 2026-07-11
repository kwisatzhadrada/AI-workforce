import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthDestination } from '@/lib/onboarding'

function safeNext(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const destination = next || (data.user ? await getPostAuthDestination(supabase, data.user.id) : '/agents')
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}

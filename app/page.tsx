import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthDestination } from '@/lib/onboarding'
import LandingPage from '@/components/marketing/LandingPage'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <LandingPage />
  redirect(await getPostAuthDestination(supabase, user.id))
}

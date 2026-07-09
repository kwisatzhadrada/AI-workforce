export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/nav/Nav'
import FeedbackWidget from '@/components/feedback/FeedbackWidget'
import { Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen bg-[#08081C]">
      <Nav profile={profile as Profile} />
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
      <FeedbackWidget userId={user.id} />
    </div>
  )
}

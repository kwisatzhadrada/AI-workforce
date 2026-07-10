import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getConversationMessages } from '@/lib/supportConversations'
import ConversationThread from '@/components/support/ConversationThread'
import { SupportConversation } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: conversation } = await supabase.from('support_conversations').select('*').eq('id', id).maybeSingle()
  if (!conversation) notFound()

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  const messages = await getConversationMessages(supabase, id)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href={profile?.is_admin ? '/admin/support/conversations' : '/support'} className="text-xs text-[#6D28D9] hover:underline">
        ← {profile?.is_admin ? 'All Conversations' : 'Support'}
      </Link>
      <ConversationThread
        conversation={conversation as SupportConversation}
        messages={messages}
        currentUserId={user.id}
        isAdmin={!!profile?.is_admin}
      />
    </div>
  )
}

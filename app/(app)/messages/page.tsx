import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AgentMessage } from '@/lib/types'
import MessageRow from '@/components/messages/MessageRow'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgMemberships } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id)
  const orgIds = (orgMemberships || []).map((m) => m.organization_id)

  const filters = [`and(receiver_type.eq.manager,receiver_id.eq.${user.id})`]
  if (orgIds.length > 0) {
    filters.push(`and(receiver_type.eq.organization,receiver_id.in.(${orgIds.join(',')}))`)
  }

  const { data: messages } = await supabase
    .from('agent_messages')
    .select('*, agents(id, name, avatar_url)')
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Messages</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Updates, questions, and alerts from agents you manage.</p>
      </div>

      {(messages || []).length === 0 ? (
        <div className="text-center text-[#8A88A8] py-16">No messages yet.</div>
      ) : (
        <div className="space-y-2">
          {(messages as AgentMessage[]).map((m) => <MessageRow key={m.id} message={m} />)}
        </div>
      )}
    </div>
  )
}

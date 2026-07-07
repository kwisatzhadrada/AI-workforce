import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Agent, AgentCredential } from '@/lib/types'
import ManageAgentForm from '@/components/agents/ManageAgentForm'

export const dynamic = 'force-dynamic'

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: agent } = await supabase.from('agents').select('*').eq('id', id).maybeSingle()
  if (!agent) notFound()
  if (agent.owner_id !== user.id) redirect(`/agent/${id}`)

  const { data: credentials } = await supabase
    .from('agent_credentials')
    .select('*')
    .eq('agent_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/agent/${id}`} className="text-sm text-[#8A88A8] hover:text-[#EDEAF8]">← Back to agent</Link>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold mt-2">Manage {agent.name}</h1>
      </div>
      <ManageAgentForm agent={agent as Agent} credentials={(credentials as AgentCredential[]) || []} />
    </div>
  )
}

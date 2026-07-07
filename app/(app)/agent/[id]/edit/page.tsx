import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Agent, AgentCategory, AgentCredential, AgentVerification } from '@/lib/types'
import ManageAgentForm from '@/components/agents/ManageAgentForm'
import CategoryPicker from '@/components/agents/CategoryPicker'
import VerificationPanel from '@/components/agents/VerificationPanel'

export const dynamic = 'force-dynamic'

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: agent } = await supabase.from('agents').select('*').eq('id', id).maybeSingle()
  if (!agent) notFound()
  if (agent.owner_id !== user.id) redirect(`/agent/${id}`)

  const [{ data: credentials }, { data: allCategories }, { data: categoryLinks }, { data: verifications }] = await Promise.all([
    supabase.from('agent_credentials').select('*').eq('agent_id', id).order('created_at', { ascending: false }),
    supabase.from('agent_categories').select('*').order('name'),
    supabase.from('agent_category_links').select('category_id').eq('agent_id', id),
    supabase.from('agent_verifications').select('*').eq('agent_id', id).order('created_at', { ascending: false }),
  ])

  const selectedCategoryIds = (categoryLinks || []).map((l) => l.category_id as string)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`/agent/${id}`} className="text-sm text-[#8A88A8] hover:text-[#EDEAF8]">← Back to agent</Link>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold mt-2">Manage {agent.name}</h1>
      </div>
      <ManageAgentForm agent={agent as Agent} credentials={(credentials as AgentCredential[]) || []} />
      <CategoryPicker agentId={id} allCategories={(allCategories as AgentCategory[]) || []} selectedIds={selectedCategoryIds} />
      <VerificationPanel agentId={id} currentLevel={agent.verification_level} verifications={(verifications as AgentVerification[]) || []} />
    </div>
  )
}

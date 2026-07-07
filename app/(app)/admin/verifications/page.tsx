import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VERIFICATION_LEVEL_LABELS, VerificationLevel } from '@/lib/types'
import { formatTimeAgo } from '@/lib/utils'
import ApproveVerificationButton from '@/components/agents/ApproveVerificationButton'

export const dynamic = 'force-dynamic'

export default async function AdminVerificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const { data: pending } = await supabase
    .from('agent_verifications')
    .select('*, agents(id, name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Verification Queue</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Pending agent verification requests.</p>
      </div>

      {(pending || []).length === 0 ? (
        <div className="text-center text-[#8A88A8] py-16">No pending requests.</div>
      ) : (
        <div className="space-y-3">
          {(pending || []).map((v) => (
            <div key={v.id} className="flex items-center justify-between bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
              <div>
                <Link href={`/agent/${v.agent_id}`} className="font-medium text-sm text-[#EDEAF8] hover:underline">
                  {v.agents?.name || 'Unknown agent'}
                </Link>
                <div className="text-xs text-[#8A88A8] mt-0.5">
                  Requesting {VERIFICATION_LEVEL_LABELS[v.level as VerificationLevel]} · {formatTimeAgo(v.created_at)}
                </div>
              </div>
              <ApproveVerificationButton verificationId={v.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

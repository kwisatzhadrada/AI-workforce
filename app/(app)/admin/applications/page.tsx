import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDesignPartnerApplications } from '@/lib/designPartnerApplications'
import { formatTimeAgo } from '@/lib/utils'
import ApplicationReviewControl from '@/components/admin/ApplicationReviewControl'
import { DesignPartnerApplicationStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<DesignPartnerApplicationStatus, string> = {
  pending: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  approved: 'text-green-400 bg-green-400/10 border-green-400/20',
  rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export default async function ApplicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const applications = await getDesignPartnerApplications(supabase)
  const pending = applications.filter((a) => a.status === 'pending')
  const decided = applications.filter((a) => a.status !== 'pending')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Design Partner Applications</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Submitted from the public /apply form — {pending.length} awaiting review.</p>
      </div>

      {applications.length === 0 ? (
        <div className="text-center text-[#8A88A8] py-10 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl">
          No applications submitted yet.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Pending</h2>
              <div className="space-y-3">
                {pending.map((a) => (
                  <div key={a.id} className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <span className="text-[#EDEAF8] font-medium">{a.company_name}</span>
                      <span className="text-xs text-[#8A88A8]">{formatTimeAgo(a.created_at)}</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#8A88A8] mb-2">
                      <div>Industry: <span className="text-[#EDEAF8]">{a.industry}</span></div>
                      <div>Team size: <span className="text-[#EDEAF8]">{a.team_size}</span></div>
                      <div>Contact: <span className="text-[#EDEAF8]">{a.contact_name}{a.contact_role ? `, ${a.contact_role}` : ''}</span></div>
                      <div>Email: <span className="text-[#EDEAF8]">{a.contact_email}</span></div>
                    </div>
                    <div className="text-xs text-[#8A88A8] space-y-1 mb-2">
                      <p><span className="text-[#EDEAF8]">Current process:</span> {a.current_sales_process}</p>
                      <p><span className="text-[#EDEAF8]">Goals:</span> {a.goals}</p>
                    </div>
                    <ApplicationReviewControl applicationId={a.id} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {decided.length > 0 && (
            <div>
              <h2 className="font-['Space_Grotesk'] font-bold text-lg mb-3">Reviewed</h2>
              <div className="space-y-2">
                {decided.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 bg-[#0C0D22] border border-[#3C3A58]/30 rounded-lg p-3">
                    <div>
                      <div className="text-sm text-[#EDEAF8]">{a.company_name}</div>
                      <div className="text-xs text-[#8A88A8]">{a.contact_name} · {a.contact_email}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md border capitalize ${STATUS_COLOR[a.status]}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

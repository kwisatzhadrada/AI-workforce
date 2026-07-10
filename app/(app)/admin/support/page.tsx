import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationTimeline } from '@/lib/support'
import { getJobFailures } from '@/lib/jobs'
import TimelineFeed from '@/components/support/TimelineFeed'
import ErrorCenterPanel from '@/components/support/ErrorCenterPanel'

export const dynamic = 'force-dynamic'

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/agents')

  const q = typeof sp.q === 'string' ? sp.q : ''
  const orgId = typeof sp.org === 'string' ? sp.org : ''

  const { data: matches } = q.trim()
    ? await supabase.from('organizations').select('id, name').ilike('name', `%${q.trim()}%`).limit(10)
    : { data: [] as { id: string; name: string }[] }

  const timeline = orgId ? await getOrganizationTimeline(supabase, orgId, 100) : []
  const { data: org } = orgId ? await supabase.from('organizations').select('id, name').eq('id', orgId).maybeSingle() : { data: null }
  const jobFailures = await getJobFailures(supabase)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Support Tools</h1>
        <p className="text-[#8A88A8] text-sm mt-1">Find an organization to see its full activity timeline or export its state for debugging.</p>
      </div>

      <ErrorCenterPanel failures={jobFailures} />

      <form action="/admin/support" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search organizations by name..."
          className="flex-1 bg-[#121428] border border-[#3C3A58] text-[#EDEAF8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
        />
        <button type="submit" className="bg-[#6D28D9] hover:bg-[#5B21B6] text-white px-4 py-2 rounded-lg text-sm font-medium">Search</button>
      </form>

      {q.trim() && !orgId && (
        <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4 space-y-1">
          {(matches || []).length === 0 ? (
            <p className="text-xs text-[#8A88A8]">No organizations match &quot;{q}&quot;.</p>
          ) : (
            (matches || []).map((m) => (
              <Link key={m.id} href={`/admin/support?org=${m.id}`} className="block text-sm text-[#EDEAF8] hover:underline py-1">
                {m.name}
              </Link>
            ))
          )}
        </div>
      )}

      {orgId && org && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-['Space_Grotesk'] font-bold text-lg">{org.name}</h2>
            <div className="flex items-center gap-3">
              <a href={`/api/admin/support/export?org_id=${orgId}`} className="text-sm text-[#6D28D9] hover:underline">
                ⬇ Export JSON
              </a>
              <Link href={`/organizations/${orgId}?tab=campaign`} className="text-sm text-[#6D28D9] hover:underline">
                View Campaign →
              </Link>
            </div>
          </div>
          <div className="bg-[#0C0D22] border border-[#3C3A58]/30 rounded-xl p-4">
            <h3 className="font-medium text-[#EDEAF8] mb-3">Activity Timeline</h3>
            <TimelineFeed events={timeline} />
          </div>
        </>
      )}
    </div>
  )
}

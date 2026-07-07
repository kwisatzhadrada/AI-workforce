import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Organization } from '@/lib/types'
import OrgCard from '@/components/organizations/OrgCard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : v
  }

  const q = get('q') || ''
  const page = Math.max(1, Number(get('page')) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('organizations')
    .select('*, organization_metrics(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q.trim()) {
    query = query.ilike('name', `%${q.trim()}%`)
  }

  const { data: organizations, count } = await query
  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Organizations</h1>
          <p className="text-[#8A88A8] text-sm mt-1">Companies that own and manage AI agents.</p>
        </div>
        <Link href="/organizations/new" className="bg-[#6D28D9] hover:bg-[#8B5CF6] text-white px-4 py-2 rounded-xl font-medium text-sm">
          + New Organization
        </Link>
      </div>

      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          className="w-full bg-[#121428] border border-[#3C3A58] focus:border-[#6D28D9] text-[#EDEAF8] placeholder-[#3C3A58] rounded-xl px-4 py-2.5 outline-none transition-colors text-sm"
          placeholder="Search organizations by name..."
        />
      </form>

      <div className="space-y-4">
        {(organizations || []).length === 0 ? (
          <div className="text-center text-[#8A88A8] py-16">No organizations found.</div>
        ) : (
          (organizations as Organization[]).map((org) => <OrgCard key={org.id} organization={org} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Link
            href={`/organizations?q=${encodeURIComponent(q)}&page=${Math.max(1, page - 1)}`}
            className={`px-4 py-2 rounded-lg text-sm border border-[#3C3A58] ${page <= 1 ? 'pointer-events-none opacity-40' : 'text-[#EDEAF8] hover:border-[#6D28D9]'}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-[#8A88A8]">Page {page} of {totalPages} · {total.toLocaleString()} organizations</span>
          <Link
            href={`/organizations?q=${encodeURIComponent(q)}&page=${Math.min(totalPages, page + 1)}`}
            className={`px-4 py-2 rounded-lg text-sm border border-[#3C3A58] ${page >= totalPages ? 'pointer-events-none opacity-40' : 'text-[#EDEAF8] hover:border-[#6D28D9]'}`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  )
}

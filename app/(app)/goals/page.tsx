import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { OrganizationGoal, OrganizationState } from '@/lib/types'
import GoalCard from '@/components/goals/GoalCard'
import GoalQueueControls from '@/components/goals/GoalQueueControls'
import OrgStatePanel from '@/components/goals/OrgStatePanel'

export const dynamic = 'force-dynamic'

export default async function GoalsPage({
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
  const orgId = get('org_id') || ''
  const status = get('status') || ''

  const { data: myOrgMemberships } = await supabase.from('organization_members').select('organizations(id, name)').eq('user_id', user.id)
  const myOrgs = Array.from(
    new Map(((myOrgMemberships || []) as unknown as { organizations: { id: string; name: string } | null }[])
      .filter((m) => m.organizations)
      .map((m) => [m.organizations!.id, m.organizations!])
    ).values()
  )

  let goals: OrganizationGoal[] = []
  let state: OrganizationState | null = null

  if (orgId) {
    let query = supabase.from('organization_goals').select('*, agents(id, name, avatar_url)').eq('organization_id', orgId)
    if (status) query = query.eq('status', status)
    const [{ data: goalsData }, { data: stateData }] = await Promise.all([
      query.order('created_at', { ascending: false }),
      supabase.from('organization_state').select('*').eq('organization_id', orgId).maybeSingle(),
    ])
    goals = (goalsData as OrganizationGoal[]) || []
    state = stateData as OrganizationState | null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Goals</h1>
          <p className="text-[#8A88A8] text-sm mt-1">Organizations operate from goals, not tasks.</p>
        </div>
        {orgId && (
          <Link href={`/goals/new?org_id=${orgId}`} className="bg-[#6D28D9] hover:bg-[#8B5CF6] text-white px-4 py-2 rounded-xl font-medium text-sm">
            + New Goal
          </Link>
        )}
      </div>

      <GoalQueueControls myOrgs={myOrgs} />

      {!orgId ? (
        <div className="text-center text-[#8A88A8] py-16">Choose an organization to see its goals.</div>
      ) : (
        <>
          <OrgStatePanel state={state} />
          {goals.length === 0 ? (
            <div className="text-center text-[#8A88A8] py-16">No goals yet.</div>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { SupabaseClient } from '@supabase/supabase-js'

// A brand-new signup has zero organizations — sending them to /agents (a
// public directory of other people's AI agents) first was the single
// biggest first-time-user friction point found in the Phase 23 launch
// audit: the guided onboarding wizard already existed and already worked,
// nothing routed a new user into it. This is the one check every
// post-auth redirect (root page, login, signup, email-confirm callback)
// now shares, so a user with no organization always lands on
// `/onboarding` instead.
export async function getPostAuthDestination(supabase: SupabaseClient, userId: string): Promise<string> {
  const [{ count: ownedCount }, { count: memberCount }] = await Promise.all([
    supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  const hasOrganization = (ownedCount || 0) > 0 || (memberCount || 0) > 0
  return hasOrganization ? '/agents' : '/onboarding'
}

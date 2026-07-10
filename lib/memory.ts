import { SupabaseClient } from '@supabase/supabase-js'
import { OrganizationMemory } from './types'

export async function getOrganizationMemory(supabase: SupabaseClient, organizationId: string): Promise<OrganizationMemory[]> {
  const { data } = await supabase
    .from('organization_memory')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  return (data as OrganizationMemory[]) || []
}

export async function generateLessonsLearned(supabase: SupabaseClient, organizationId: string): Promise<string[]> {
  const { data } = await supabase.rpc('generate_lessons_learned', { p_org_id: organizationId })
  return (data as string[]) || []
}

import { SupabaseClient } from '@supabase/supabase-js'
import { Experiment, OrganizationExecutive } from './types'

export async function createExperiment(
  supabase: SupabaseClient,
  params: { organizationId: string; goalId: string | null; subjectA: string; subjectB: string }
): Promise<{ experiment: Experiment | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_experiment', {
    p_org_id: params.organizationId,
    p_goal_id: params.goalId,
    p_subject_a: params.subjectA,
    p_subject_b: params.subjectB,
  })
  if (error) return { experiment: null, error: error.message }
  return { experiment: data as Experiment, error: null }
}

export async function getExperiments(supabase: SupabaseClient, organizationId: string): Promise<Experiment[]> {
  const { data } = await supabase.from('experiments').select('*').eq('organization_id', organizationId).order('started_at', { ascending: false })
  return (data as Experiment[]) || []
}

export async function getRunningSubjectLineExperiment(supabase: SupabaseClient, organizationId: string): Promise<Experiment | null> {
  const { data } = await supabase
    .from('experiments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('experiment_type', 'subject_line')
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Experiment) || null
}

export async function assignExperimentVariant(supabase: SupabaseClient, experimentId: string, contactEmail: string): Promise<'a' | 'b' | null> {
  const { data, error } = await supabase.rpc('assign_experiment_variant', { p_experiment_id: experimentId, p_contact_email: contactEmail })
  if (error || !data) return null
  return data as 'a' | 'b'
}

export async function concludeExperiment(supabase: SupabaseClient, experimentId: string): Promise<{ experiment: Experiment | null; error: string | null }> {
  const { data, error } = await supabase.rpc('conclude_experiment', { p_experiment_id: experimentId })
  if (error) return { experiment: null, error: error.message }
  return { experiment: data as Experiment, error: null }
}

// At autonomy level 4 this happens automatically inside conclude_experiment().
// Below that, a manager applies a concluded test's winner explicitly.
export async function applyExperimentWinner(supabase: SupabaseClient, experimentId: string): Promise<{ executive: OrganizationExecutive | null; error: string | null }> {
  const { data, error } = await supabase.rpc('apply_experiment_winner', { p_experiment_id: experimentId })
  if (error) return { executive: null, error: error.message }
  return { executive: data as OrganizationExecutive, error: null }
}

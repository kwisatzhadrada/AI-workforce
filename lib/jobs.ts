import { SupabaseClient } from '@supabase/supabase-js'
import { Job, JobFailure, JobType } from './types'

export async function enqueueJob(
  supabase: SupabaseClient,
  params: { organizationId: string; jobType: JobType; payload?: Record<string, unknown>; scheduledFor?: string }
): Promise<{ job: Job | null; error: string | null }> {
  const { data, error } = await supabase.rpc('enqueue_job', {
    p_org_id: params.organizationId,
    p_job_type: params.jobType,
    p_payload: params.payload || {},
    p_scheduled_for: params.scheduledFor || new Date().toISOString(),
  })
  if (error) return { job: null, error: error.message }
  return { job: data as Job, error: null }
}

export async function getJobs(supabase: SupabaseClient, organizationId: string, limit = 20): Promise<Job[]> {
  const { data } = await supabase
    .from('job_queue')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as Job[]) || []
}

export async function getJobFailures(supabase: SupabaseClient, organizationId?: string): Promise<JobFailure[]> {
  let query = supabase.from('job_failures').select('*, organizations(id, name)').order('created_at', { ascending: false })
  if (organizationId) query = query.eq('organization_id', organizationId)
  const { data } = await query
  return (data as JobFailure[]) || []
}

export async function resolveJobFailure(supabase: SupabaseClient, failureId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('resolve_job_failure', { p_failure_id: failureId })
  return { error: error?.message || null }
}

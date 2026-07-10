import { SupabaseClient } from '@supabase/supabase-js'
import { AuditLogEntry } from './types'

export async function getAuditLog(supabase: SupabaseClient, organizationId: string, limit = 50): Promise<AuditLogEntry[]> {
  const { data } = await supabase
    .from('audit_log')
    .select('*, profiles(id, full_name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as AuditLogEntry[]) || []
}

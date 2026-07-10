import { SupabaseClient } from '@supabase/supabase-js'
import { NextBestAction, ReplyClassification } from './types'

export async function getReplyClassifications(supabase: SupabaseClient, organizationId: string, limit = 50): Promise<ReplyClassification[]> {
  const { data } = await supabase
    .from('reply_classifications')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as ReplyClassification[]) || []
}

export async function getNextBestAction(supabase: SupabaseClient, organizationId: string): Promise<NextBestAction[]> {
  const { data } = await supabase.rpc('get_next_best_action', { p_org_id: organizationId })
  return (data as NextBestAction[]) || []
}

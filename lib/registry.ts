import { SupabaseClient } from '@supabase/supabase-js'
import {
  AgentSearchResult, AgentSortOption, AgentVerification, FollowEntityType, VerificationType,
} from './types'

// ============================================================
// Search / directory
// ============================================================

export type AgentSearchFilters = {
  query?: string
  categorySlug?: string
  status?: string
  minReputation?: number
  minVerificationLevel?: number
  minPerformance?: number
  sort?: AgentSortOption
  page?: number
  pageSize?: number
}

export async function searchAgents(
  supabase: SupabaseClient,
  filters: AgentSearchFilters
): Promise<{ agents: AgentSearchResult[]; total: number; error: string | null }> {
  const { data, error } = await supabase.rpc('search_agents', {
    p_query: filters.query || null,
    p_category_slug: filters.categorySlug || null,
    p_status: filters.status || null,
    p_min_reputation: filters.minReputation ?? null,
    p_min_verification_level: filters.minVerificationLevel ?? null,
    p_min_performance: filters.minPerformance ?? null,
    p_sort: filters.sort || 'top_rated',
    p_page: filters.page || 1,
    p_page_size: filters.pageSize || 20,
  })

  if (error) return { agents: [], total: 0, error: error.message }
  const rows = (data as AgentSearchResult[]) || []
  return { agents: rows, total: rows[0]?.total_count ?? 0, error: null }
}

// ============================================================
// Categories
// ============================================================

export async function setAgentCategories(
  supabase: SupabaseClient,
  agentId: string,
  categoryIds: string[]
): Promise<{ error: string | null }> {
  const { error: deleteError } = await supabase.from('agent_category_links').delete().eq('agent_id', agentId)
  if (deleteError) return { error: deleteError.message }

  if (categoryIds.length === 0) return { error: null }

  const { error: insertError } = await supabase
    .from('agent_category_links')
    .insert(categoryIds.map((categoryId) => ({ agent_id: agentId, category_id: categoryId })))

  if (insertError) return { error: insertError.message }
  return { error: null }
}

// ============================================================
// Verification
// ============================================================

export async function requestAgentVerification(
  supabase: SupabaseClient,
  agentId: string,
  verificationType: VerificationType,
  level: number
): Promise<{ verification: AgentVerification | null; error: string | null }> {
  const { data, error } = await supabase.rpc('request_agent_verification', {
    p_agent_id: agentId,
    p_verification_type: verificationType,
    p_level: level,
  })

  if (error) return { verification: null, error: error.message }
  return { verification: data as AgentVerification, error: null }
}

export async function grantAgentVerification(
  supabase: SupabaseClient,
  verificationId: string,
  expiresAt?: string
): Promise<{ verification: AgentVerification | null; error: string | null }> {
  const { data, error } = await supabase.rpc('grant_agent_verification', {
    p_verification_id: verificationId,
    p_expires_at: expiresAt || null,
  })

  if (error) return { verification: null, error: error.message }
  return { verification: data as AgentVerification, error: null }
}

// ============================================================
// Portfolio
// ============================================================

export async function addAgentProject(
  supabase: SupabaseClient,
  agentId: string,
  project: { title: string; description?: string; results?: string; proofLinks?: string[] }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_projects').insert({
    agent_id: agentId,
    title: project.title.trim(),
    description: project.description?.trim() || null,
    results: project.results?.trim() || null,
    proof_links: project.proofLinks?.filter(Boolean) || [],
  })

  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// Follow system
// ============================================================

export async function followEntity(
  supabase: SupabaseClient,
  follower: { type: FollowEntityType; id: string },
  followee: { type: FollowEntityType; id: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('follows').insert({
    follower_type: follower.type,
    follower_id: follower.id,
    followee_type: followee.type,
    followee_id: followee.id,
  })

  if (error && error.code !== '23505') return { error: error.message }
  return { error: null }
}

export async function unfollowEntity(
  supabase: SupabaseClient,
  follower: { type: FollowEntityType; id: string },
  followee: { type: FollowEntityType; id: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_type', follower.type)
    .eq('follower_id', follower.id)
    .eq('followee_type', followee.type)
    .eq('followee_id', followee.id)

  if (error) return { error: error.message }
  return { error: null }
}

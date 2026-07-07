export type Profile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  followers_count: number
  following_count: number
  created_at: string
  updated_at: string
}

// ============================================================
// Agent Identity Layer
// ============================================================

export type AgentStatus = 'active' | 'inactive' | 'suspended'

export type Agent = {
  id: string
  owner_id: string
  name: string
  description: string | null
  avatar_url: string | null
  skills: string[]
  status: AgentStatus
  reputation_score: number
  rating_count: number
  verification_level: VerificationLevel
  trust_score: number
  performance_score: number
  trending_score: number
  followers_count: number
  following_count: number
  created_at: string
  updated_at: string
  profiles?: Profile
  agent_credentials?: AgentCredential[]
  agent_wallets?: AgentWallet
  agent_performance_metrics?: AgentPerformanceMetrics
  agent_categories?: AgentCategory[]
}

export type AgentCredential = {
  id: string
  agent_id: string
  title: string
  issuer: string | null
  credential_url: string | null
  verified: boolean
  issued_at: string | null
  expires_at: string | null
  created_at: string
}

export type AgentRating = {
  id: string
  agent_id: string
  rater_id: string
  score: number
  comment: string | null
  created_at: string
  profiles?: Profile
}

export type AgentWallet = {
  agent_id: string
  balance: number
  currency: string
  updated_at: string
}

export type AgentTransactionType = 'credit' | 'debit'

export type AgentTransaction = {
  id: string
  agent_id: string
  type: AgentTransactionType
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

export type AgentPerformanceMetrics = {
  agent_id: string
  tasks_completed: number
  tasks_failed: number
  avg_response_time_ms: number | null
  success_rate: number
  last_active_at: string | null
  updated_at: string
}

// ============================================================
// Agent Registry v2
// ============================================================

export type AgentCategory = {
  id: string
  name: string
  slug: string
  created_at: string
}

export type VerificationLevel = 0 | 1 | 2 | 3 | 4

export const VERIFICATION_LEVEL_LABELS: Record<VerificationLevel, string> = {
  0: 'Unverified',
  1: 'Identity Verified',
  2: 'Skill Verified',
  3: 'Performance Verified',
  4: 'Trusted Workforce Agent',
}

export type VerificationType = 'identity' | 'skill' | 'performance' | 'trusted_workforce'

export const VERIFICATION_TYPE_LEVEL: Record<VerificationType, VerificationLevel> = {
  identity: 1,
  skill: 2,
  performance: 3,
  trusted_workforce: 4,
}

export type VerificationStatus = 'pending' | 'active' | 'revoked' | 'expired'

export type AgentVerification = {
  id: string
  agent_id: string
  level: VerificationLevel
  verification_type: VerificationType
  verifier_id: string | null
  status: VerificationStatus
  issued_at: string | null
  expires_at: string | null
  created_at: string
}

export type AgentProject = {
  id: string
  agent_id: string
  title: string
  description: string | null
  results: string | null
  proof_links: string[]
  metrics: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AgentActivityType =
  | 'profile_updated' | 'credential_earned' | 'verification_earned'
  | 'rating_received' | 'project_added'

export type AgentActivity = {
  id: string
  agent_id: string
  activity_type: AgentActivityType
  payload: Record<string, unknown>
  created_at: string
  agents?: Pick<Agent, 'id' | 'name' | 'avatar_url'>
}

export type FollowEntityType = 'user' | 'agent'

export type Follow = {
  id: string
  follower_type: FollowEntityType
  follower_id: string
  followee_type: FollowEntityType
  followee_id: string
  created_at: string
}

export type AgentSortOption = 'top_rated' | 'newest' | 'most_active' | 'highest_performance' | 'trending'

// Shape returned by the search_agents() RPC — a deliberately narrower
// projection than the full Agent row (see migration 003).
export type AgentSearchResult = {
  id: string
  owner_id: string
  name: string
  description: string | null
  avatar_url: string | null
  skills: string[]
  status: AgentStatus
  reputation_score: number
  rating_count: number
  trust_score: number
  performance_score: number
  trending_score: number
  verification_level: VerificationLevel
  followers_count: number
  created_at: string
  total_count: number
}

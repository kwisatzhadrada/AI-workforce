export type Profile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
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
  created_at: string
  updated_at: string
  profiles?: Profile
  agent_credentials?: AgentCredential[]
  agent_wallets?: AgentWallet
  agent_performance_metrics?: AgentPerformanceMetrics
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

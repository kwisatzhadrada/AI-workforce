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

// ============================================================
// Organization Layer (Phase 3)
// ============================================================

export type Organization = {
  id: string
  owner_id: string
  name: string
  slug: string | null
  description: string | null
  avatar_url: string | null
  website_url: string | null
  industry: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
  organization_metrics?: OrganizationMetrics
}

export type OrgRoleSlug = 'owner' | 'manager' | 'supervisor' | 'agent'

export type OrganizationRole = {
  id: string
  slug: OrgRoleSlug
  name: string
  level: number
  created_at: string
}

export type OrganizationMember = {
  id: string
  organization_id: string
  user_id: string
  role_id: string
  invited_by: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
  organization_roles?: OrganizationRole
}

export type OrganizationDepartment = {
  id: string
  organization_id: string
  name: string
  slug: string
  is_custom: boolean
  created_at: string
  updated_at: string
}

export type AssignmentPriority = 'low' | 'medium' | 'high' | 'critical'
export type AssignmentStatus = 'active' | 'paused' | 'completed' | 'removed'

export type AgentAssignment = {
  id: string
  agent_id: string
  organization_id: string
  department_id: string | null
  manager_type: FollowEntityType | null
  manager_id: string | null
  priority: AssignmentPriority
  status: AssignmentStatus
  assigned_by: string
  created_at: string
  updated_at: string
  agents?: Pick<Agent, 'id' | 'name' | 'avatar_url' | 'status' | 'trust_score' | 'owner_id'>
  organization_departments?: OrganizationDepartment
}

export type OrganizationMetrics = {
  organization_id: string
  total_agents: number
  active_agents: number
  tasks_completed: number
  tasks_failed: number
  success_rate: number
  trust_score: number
  reputation_score: number
  updated_at: string
}

export type OrganizationActivityType =
  | 'member_joined' | 'member_removed' | 'agent_joined' | 'agent_removed'
  | 'department_created' | 'verification_earned' | 'trust_score_changed'
  | 'assignment_completed' | 'workflow_completed'
  | 'goal_created' | 'goal_completed' | 'goal_failed' | 'plan_approved'

export type OrganizationActivity = {
  id: string
  organization_id: string
  activity_type: OrganizationActivityType
  payload: Record<string, unknown>
  created_at: string
}

export type WorkflowStatus = 'draft' | 'active' | 'archived'

export type Workflow = {
  id: string
  organization_id: string
  name: string
  description: string | null
  status: WorkflowStatus
  created_by: string
  created_at: string
  updated_at: string
  workflow_steps?: WorkflowStep[]
}

export type WorkflowStep = {
  id: string
  workflow_id: string
  step_order: number
  name: string
  department_id: string | null
  agent_id: string | null
  created_at: string
  organization_departments?: OrganizationDepartment
  agents?: Pick<Agent, 'id' | 'name' | 'avatar_url'>
}

export type WorkflowRunStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export type WorkflowRun = {
  id: string
  workflow_id: string
  organization_id: string
  status: WorkflowRunStatus
  current_step_order: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  workflows?: Pick<Workflow, 'id' | 'name'>
}

export type WorkflowStepRunStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

export type WorkflowStepRun = {
  id: string
  workflow_run_id: string
  workflow_step_id: string
  agent_id: string | null
  status: WorkflowStepRunStatus
  notes: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  workflow_steps?: WorkflowStep
}

// ============================================================
// Work Execution Layer (Phase 4)
// ============================================================

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'review' | 'completed' | 'failed'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  review: 'Review',
  completed: 'Completed',
  failed: 'Failed',
}

export type Task = {
  id: string
  title: string
  description: string | null
  organization_id: string
  department_id: string | null
  created_by: string
  assigned_agent_id: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  execution_time_seconds: number | null
  output: Record<string, unknown>
  result_summary: string | null
  attachments: string[]
  workflow_run_id: string | null
  workflow_step_id: string | null
  created_at: string
  updated_at: string
  organizations?: Pick<Organization, 'id' | 'name'>
  organization_departments?: Pick<OrganizationDepartment, 'id' | 'name'>
  agents?: Pick<Agent, 'id' | 'name' | 'avatar_url' | 'owner_id'>
  profiles?: Profile
  task_reviews?: TaskReview[]
}

export type TaskReview = {
  id: string
  task_id: string
  reviewer_id: string
  rating: number
  feedback: string | null
  quality_score: number | null
  speed_score: number | null
  created_at: string
  profiles?: Profile
}

export type TaskEventType = 'created' | 'assigned' | 'started' | 'completed' | 'reviewed' | 'failed'

export type TaskHistoryEvent = {
  id: string
  task_id: string
  event_type: TaskEventType
  actor_id: string | null
  payload: Record<string, unknown>
  created_at: string
  profiles?: Profile
}

// ============================================================
// Agent Runtime Layer (Phase 5)
// ============================================================

export type AgentCapability = {
  id: string
  agent_id: string
  name: string
  description: string | null
  input_schema: Record<string, unknown>
  output_schema: Record<string, unknown>
  cost_estimate: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export const CAPABILITY_EXAMPLES = [
  'Research', 'Writing', 'Summarization', 'Lead Generation',
  'Data Analysis', 'Customer Support', 'Coding', 'Planning',
]

export type ExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ModelProviderName = 'openai' | 'anthropic' | 'local'

export type AgentExecution = {
  id: string
  agent_id: string
  task_id: string | null
  capability_id: string | null
  status: ExecutionStatus
  provider: ModelProviderName | null
  model: string | null
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  execution_time_ms: number | null
  tokens_used: number | null
  cost: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  agents?: Pick<Agent, 'id' | 'name' | 'avatar_url' | 'owner_id'>
  tasks?: Pick<Task, 'id' | 'title'>
  agent_capabilities?: Pick<AgentCapability, 'id' | 'name'>
}

export type DecisionType =
  | 'accept_task' | 'complete_task' | 'request_assistance' | 'delegate'
  | 'create_task' | 'assign_task' | 'monitor_progress' | 'escalate_failure'

export type AgentDecision = {
  id: string
  agent_id: string
  task_id: string | null
  execution_id: string | null
  decision_type: DecisionType
  outcome: 'yes' | 'no'
  reasoning: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
}

export type AgentErrorLog = {
  id: string
  agent_id: string
  execution_id: string | null
  task_id: string | null
  error_type: string
  message: string
  context: Record<string, unknown>
  created_at: string
}

export type MemoryType = 'fact' | 'preference' | 'learned_pattern' | 'context'

export type AgentMemory = {
  id: string
  agent_id: string
  organization_id: string | null
  memory_type: MemoryType
  key: string
  value: Record<string, unknown>
  importance: number
  created_at: string
  updated_at: string
}

export type MessageReceiverType = 'agent' | 'organization' | 'manager'
export type AgentMessageType = 'update' | 'question' | 'alert' | 'handoff' | 'report'

export type AgentMessage = {
  id: string
  sender_agent_id: string
  receiver_type: MessageReceiverType
  receiver_id: string
  message_type: AgentMessageType
  content: string
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
  agents?: Pick<Agent, 'id' | 'name' | 'avatar_url'>
}

export type DelegationStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed'

export type Delegation = {
  id: string
  task_id: string
  from_agent_id: string
  to_agent_id: string
  reason: string | null
  status: DelegationStatus
  outcome: string | null
  created_at: string
  updated_at: string
  from_agent?: Pick<Agent, 'id' | 'name' | 'avatar_url'>
  to_agent?: Pick<Agent, 'id' | 'name' | 'avatar_url'>
  tasks?: Pick<Task, 'id' | 'title'>
}

// ============================================================
// Autonomous Organization Layer (Phase 6)
// ============================================================

export type GoalStatus = 'draft' | 'active' | 'completed' | 'failed'

export type OrganizationGoal = {
  id: string
  organization_id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: GoalStatus
  is_paused: boolean
  target_metrics: Record<string, unknown>
  deadline: string | null
  manager_agent_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  agents?: Pick<Agent, 'id' | 'name' | 'avatar_url'>
}

export type PlanStatus = 'draft' | 'approved' | 'rejected' | 'completed'

export type GoalPlan = {
  id: string
  goal_id: string
  status: PlanStatus
  generated_by: 'human' | 'ai'
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  goal_plan_steps?: GoalPlanStep[]
}

export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export type GoalPlanStep = {
  id: string
  plan_id: string
  step_order: number
  title: string
  description: string | null
  department_id: string | null
  estimated_effort_hours: number | null
  status: PlanStepStatus
  task_id: string | null
  created_at: string
  updated_at: string
  organization_departments?: Pick<OrganizationDepartment, 'id' | 'name'>
  depends_on?: string[]
}

export type OrganizationState = {
  organization_id: string
  active_goals: number
  blocked_goals: number
  resource_utilization: number
  agent_utilization: number
  risk_score: number
  updated_at: string
}

export type AgentUtilization = {
  agent_id: string
  idle_seconds: number | null
  active_seconds: number
  task_volume: number
  success_rate: number
}

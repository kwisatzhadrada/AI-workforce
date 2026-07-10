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
  company_size: string | null
  avg_deal_value: number | null
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
  requires_approval: boolean
  approved_at: string | null
  approved_by: string | null
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

export type IntegrationAction = 'prospect_enrich' | 'email_draft_send' | 'crm_upsert'

export type AgentCapability = {
  id: string
  agent_id: string
  name: string
  description: string | null
  input_schema: Record<string, unknown>
  output_schema: Record<string, unknown>
  cost_estimate: number
  enabled: boolean
  integration_action: IntegrationAction | null
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
  integration_action: IntegrationAction | null
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

// ============================================================
// Workforce Templates (Phase 7)
// ============================================================

export type WorkforceTemplate = {
  id: string
  name: string
  description: string | null
  industry: string | null
  goal: string | null
  configuration: Record<string, unknown>
  created_by: string | null
  usage_count: number
  created_at: string
  updated_at: string
}

export type CapabilityBlueprint = {
  name: string
  description?: string
  cost_estimate?: number
  input_schema?: Record<string, unknown>
  output_schema?: Record<string, unknown>
}

export type MemoryDefaultBlueprint = {
  memory_type: MemoryType
  key: string
  value: unknown
}

export type AgentBlueprint = {
  id: string
  template_id: string
  name: string
  description: string | null
  default_prompt: string | null
  capabilities: CapabilityBlueprint[]
  memory_defaults: MemoryDefaultBlueprint[]
  workflow_role: string | null
  department_slug: string | null
  is_manager: boolean
  created_at: string
}

export type WorkflowBlueprint = {
  id: string
  template_id: string
  name: string
  description: string | null
  created_at: string
  workflow_blueprint_steps?: WorkflowBlueprintStep[]
}

export type WorkflowBlueprintStep = {
  id: string
  workflow_blueprint_id: string
  step_order: number
  name: string
  agent_blueprint_id: string | null
  department_slug: string | null
  created_at: string
  agent_blueprints?: Pick<AgentBlueprint, 'id' | 'name'>
}

export type GoalBlueprint = {
  id: string
  template_id: string
  title: string
  description: string | null
  priority: TaskPriority
  target_metrics: Record<string, unknown>
  manager_agent_blueprint_id: string | null
  created_at: string
  agent_blueprints?: Pick<AgentBlueprint, 'id' | 'name'>
}

export type DeploymentStatus = 'success' | 'failed'

export type TemplateDeployment = {
  id: string
  template_id: string
  organization_id: string | null
  deployed_by: string
  status: DeploymentStatus
  error: string | null
  created_at: string
  organizations?: Pick<Organization, 'id' | 'name'>
}

export type TemplateMetrics = {
  usage_count: number
  deployments_total: number
  deployments_success: number
  deployment_success_rate: number
  goals_total: number
  goals_completed: number
  goal_completion_rate: number
}

// ============================================================
// Simulation, Validation & Autonomy Layer (Phase 8)
// ============================================================
export type SimulationRunStatus = 'running' | 'completed' | 'failed'

export type SimulationRun = {
  id: string
  status: SimulationRunStatus
  target_agents: number
  target_organizations: number
  target_tasks: number
  target_goals: number
  target_workflows: number
  actual_agents: number
  actual_organizations: number
  actual_tasks: number
  actual_goals: number
  actual_workflows: number
  organization_ids: string[]
  triggered_by: string | null
  error: string | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  created_at: string
}

export type SimulationEvent = {
  id: string
  run_id: string
  event_type: string
  entity_type: string
  entity_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

export type SimulationMetric = {
  id: string
  run_id: string
  metric_name: string
  metric_value: number
  metadata: Record<string, unknown>
  created_at: string
}

export type ReportType = 'daily' | 'weekly' | 'monthly'

export type SystemReport = {
  id: string
  report_type: ReportType
  period_start: string
  period_end: string
  generated_by: string | null
  content: {
    network_health: NetworkHealth
    autonomy_score: AutonomyScore
    top_organizations: { organization_id: string; name: string; success_rate: number; tasks_completed: number }[]
    top_agents: { agent_id: string; name: string; trust_score: number; tasks_completed: number | null }[]
    problem_areas: {
      overloaded_agents: number
      idle_agents: number
      stuck_goals: number
      task_assignment_failures: number
    }
    optimization_opportunities: string[]
    top_performers: RankedAgent[]
    biggest_risks: { entity_type: string; entity_id: string; prediction_type: PredictionType; predicted_value: number; confidence: number }[]
    growth_opportunities: { agent_id: string; name: string; growth_trend: GrowthTrend; specializations: string[] }[]
    optimization_suggestions: { recommendation_type: RecommendationType; entity_type: string; entity_id: string; title: string; reason: string; expected_impact: string; confidence_score: number }[]
  }
  created_at: string
}

export type NetworkHealth = {
  active_organizations: number
  active_agents: number
  task_throughput_24h: number
  goal_completion_rate: number
  avg_runtime_seconds: number
  failure_rate: number
}

export type AutonomyScore = {
  pct_tasks_auto_created: number
  pct_tasks_auto_completed: number
  pct_goals_autonomous: number
  pct_workflows_autonomous: number
  overall_score: number
}

export type OverloadedAgent = { agent_id: string; agent_name: string; live_task_count: number; trust_score: number }
export type IdleAgent = { agent_id: string; agent_name: string; last_active_at: string | null; trust_score: number }
export type WorkflowDeadlock = { workflow_run_id: string; workflow_id: string; organization_id: string; current_step_order: number; stalled_since: string | null }
export type StuckGoal = { goal_id: string; organization_id: string; title: string; updated_at: string; is_paused: boolean }
export type TaskAssignmentFailure = { task_id: string; organization_id: string; title: string; created_at: string }
export type TrustScoreAnomaly = { agent_id: string; agent_name: string; trust_score: number; recent_failures: number }

// ============================================================
// Workforce Intelligence Layer (Phase 9)
// ============================================================
export type InsightEntityType = 'agent' | 'organization' | 'workflow' | 'template' | 'platform'

export type WorkforceInsight = {
  id: string
  insight_type: string
  entity_type: InsightEntityType
  entity_id: string | null
  title: string
  detail: string | null
  metrics: Record<string, unknown>
  created_at: string
}

export type PredictionType = 'task_success_probability' | 'goal_success_probability' | 'workflow_failure_probability' | 'agent_burnout_risk' | 'organization_risk_score'
export type PredictionEntityType = 'task' | 'goal' | 'workflow' | 'agent' | 'organization'

export type WorkforcePrediction = {
  id: string
  prediction_type: PredictionType
  entity_type: PredictionEntityType
  entity_id: string
  predicted_value: number
  confidence: number
  metadata: Record<string, unknown>
  created_at: string
}

export type RecommendationType = 'reassign_agent' | 'add_agent' | 'replace_workflow_step' | 'rebalance_load'
export type RecommendationEntityType = 'agent' | 'organization' | 'workflow' | 'workflow_step' | 'department'
export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'applied'

export type WorkforceRecommendation = {
  id: string
  recommendation_type: RecommendationType
  entity_type: RecommendationEntityType
  entity_id: string
  title: string
  reason: string
  expected_impact: string
  confidence_score: number
  status: RecommendationStatus
  metadata: Record<string, unknown> & { organization_id?: string }
  reviewed_by: string | null
  reviewed_at: string | null
  applied_at: string | null
  created_at: string
}

export type GrowthTrend = 'improving' | 'declining' | 'stable' | 'insufficient_data'

export type AgentProfileIntelligence = {
  agent_id: string
  strengths: string[]
  weaknesses: string[]
  specializations: string[]
  risk_factors: string[]
  growth_trend: GrowthTrend
  goal_contribution_count: number
  workflow_success_rate: number | null
  delegation_effectiveness: number | null
  updated_at: string
}

export type CareerHistoryEvent = { event_type: string; at: string; [key: string]: unknown }
export type PerformanceSnapshot = { trust_score: number; success_rate: number; career_score: number; at: string }

export type AgentCareer = {
  agent_id: string
  first_task_id: string | null
  first_task_at: string | null
  last_task_id: string | null
  last_task_at: string | null
  promotion_history: CareerHistoryEvent[]
  organization_history: CareerHistoryEvent[]
  performance_history: PerformanceSnapshot[]
  career_score: number
  updated_at: string
}

export type OrganizationHealth = {
  organization_id: string
  goal_completion_rate: number
  workflow_completion_rate: number
  agent_utilization: number
  task_throughput: number
  failure_rate: number
  autonomy_score: number
  health_score: number
  updated_at: string
}

export type WorkflowIntelligence = {
  success_rate: number
  avg_duration_seconds: number | null
  total_runs: number
  failure_points: { step_order: number; name: string; failure_count: number }[]
  avg_handoff_seconds: number | null
}

export type RankedAgent = { agent_id: string; name: string; trust_score: number; success_rate: number; career_score: number; rank: number }
export type RankedOrganization = { organization_id: string; name: string; health_score: number; rank: number }
export type RankedWorkflow = { workflow_id: string; name: string; success_rate: number; total_runs: number }
export type RankedTemplate = { template_id: string; name: string; deployment_success_rate: number; goal_completion_rate: number; usage_count: number; rank: number }

export type AgentComparison = { agent_id: string; name: string; trust_score: number; success_rate: number; career_score: number; growth_trend: GrowthTrend }
export type OrganizationComparison = { organization_id: string; name: string; health_score: number; goal_completion_rate: number; workflow_completion_rate: number; failure_rate: number }
export type WorkflowComparison = { workflow_id: string; name: string; success_rate: number; avg_duration_seconds: number | null; total_runs: number }

export type UnusualFailure = { agent_id: string; agent_name: string; recent_failure_rate: number; historical_failure_rate: number }
export type DelegationLoop = { task_id: string; delegation_count: number; agents_involved: string[] }
export type UnderperformingOrganization = { organization_id: string; name: string; health_score: number; platform_avg: number }

export type AnomalyReport = {
  unusual_failures: UnusualFailure[]
  trust_score_anomalies: TrustScoreAnomaly[]
  delegation_loops: DelegationLoop[]
  workflow_deadlocks: WorkflowDeadlock[]
  underperforming_organizations: UnderperformingOrganization[]
}

// ============================================================
// B2B Sales Vertical: Real Integrations (Phase 10)
// ============================================================
export type IntegrationProvider = 'gmail' | 'hubspot' | 'hunter'
export type IntegrationStatus = 'connected' | 'disconnected' | 'error'

export type OrganizationIntegration = {
  id: string
  organization_id: string
  provider: IntegrationProvider
  status: IntegrationStatus
  connected_by: string | null
  connected_at: string
  last_synced_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type SalesActivityType = 'lead_found' | 'email_drafted' | 'email_sent' | 'reply_received' | 'meeting_booked' | 'contact_synced'

export type AgentActivitySummary = {
  agentId: string
  agentName: string
  activityType: SalesActivityType
  count: number
}

export type SalesActivity = {
  id: string
  organization_id: string
  activity_type: SalesActivityType
  agent_id: string | null
  task_id: string | null
  contact_email: string | null
  contact_name: string | null
  contact_company: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type SalesMetrics = {
  leads_found: number
  emails_sent: number
  replies_received: number
  meetings_booked: number
  reply_rate: number
  avg_deal_value: number | null
  estimated_pipeline_value: number
}

export type OutreachDraft = {
  email: string
  name: string | null
  company: string | null
  domain: string
  subject: string
  body: string
}

export type ExecutionHistoryRow = {
  execution_id: string
  agent_id: string
  agent_name: string
  task_id: string | null
  task_title: string | null
  capability_name: string | null
  integration_action: IntegrationAction | null
  status: string
  provider: string
  error: string | null
  created_at: string
  completed_at: string | null
}

export type IntegrationHistoryRow = {
  id: string
  organization_id: string
  organization_name: string
  activity_type: string
  payload: Record<string, unknown>
  created_at: string
}

export type ExecutionFailureRow = {
  execution_id: string
  agent_id: string
  agent_name: string
  task_id: string | null
  task_title: string | null
  error: string | null
  created_at: string
}

export type TaskRetryRow = {
  task_id: string
  task_title: string
  organization_id: string
  organization_name: string
  execution_count: number
  last_status: string
  last_created_at: string
}

export type AssignmentDecisionRow = {
  id: string
  task_id: string | null
  task_title: string | null
  manager_agent_id: string
  manager_agent_name: string
  assigned_agent_id: string | null
  assigned_agent_name: string | null
  outcome: string
  reasoning: string
  outputs: Record<string, unknown>
  created_at: string
}

export type AnalyticsFunnel = {
  organizations_created: number
  workforces_deployed: number
  campaigns_launched: number
  emails_drafted: number
  emails_sent: number
  replies_received: number
  meetings_booked: number
}

export type AnalyticsByOrganization = {
  organization_id: string
  organization_name: string
  created_at: string
  workforce_deployed: boolean
  integrations_connected: boolean
  campaign_launched: boolean
  campaign_approved: boolean
  emails_drafted: number
  emails_sent: number
  replies_received: number
  meetings_booked: number
}

export type OnboardingFunnel = {
  accounts_created: number
  organizations_created: number
  workforces_deployed: number
  integrations_connected: number
  campaigns_created: number
  campaigns_approved: number
  first_email_sent: number
}

export type PlatformOverview = {
  active_organizations: number
  connected_integrations: number
  active_campaigns: number
  emails_sent: number
  replies_received: number
  meetings_booked: number
}

export type OrganizationTimelineEvent = {
  source: 'organization' | 'sales' | 'decision'
  event_type: string
  detail: Record<string, unknown>
  created_at: string
}

export type FeedbackType = 'bug' | 'feature_request' | 'general' | 'blocker'
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type BlockerReason = 'confusing_workflow' | 'poor_leads' | 'no_replies' | 'integrations' | 'missing_features' | 'other'

export type UserFeedback = {
  id: string
  user_id: string
  organization_id: string | null
  feedback_type: FeedbackType
  message: string
  page_url: string | null
  status: FeedbackStatus
  admin_notes: string | null
  blocker_reason: BlockerReason | null
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'full_name'>
}

export type MeetingStatus = 'requested' | 'scheduled' | 'completed' | 'cancelled'

export type Meeting = {
  id: string
  organization_id: string
  task_id: string | null
  contact_email: string
  contact_name: string | null
  contact_company: string | null
  status: MeetingStatus
  scheduled_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  estimated_value: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deal_outcome: DealOutcome | null
  deal_value: number | null
  deal_closed_at: string | null
}

export type MeetingFunnel = {
  requested: number
  scheduled: number
  completed: number
  cancelled: number
  total: number
}

export type OrganizationReportType = 'weekly' | 'monthly' | 'quarterly'

export type OrganizationReportContent = {
  leads_found: number
  emails_sent: number
  replies_received: number
  meetings_booked: number
  meetings_requested: number
  meetings_scheduled: number
  meetings_completed: number
  meetings_cancelled: number
  recommendations: string[]
}

export type OrganizationReport = {
  id: string
  organization_id: string
  report_type: OrganizationReportType
  period_start: string
  period_end: string
  content: OrganizationReportContent
  generated_by: string | null
  created_at: string
}

export type DesignPartnerStatus = 'prospect' | 'contacted' | 'demo_scheduled' | 'trial_active' | 'active_user' | 'paying_customer' | 'churned'

export type DesignPartner = {
  id: string
  organization_id: string
  contact_name: string | null
  contact_email: string | null
  contact_role: string | null
  status: DesignPartnerStatus
  satisfaction_score: number | null
  requested_features: string | null
  feedback_notes: string | null
  meeting_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  organizations?: Pick<Organization, 'id' | 'name' | 'industry' | 'company_size'>
}

export type JourneyMilestone = {
  milestone: 'signup' | 'template_deployed' | 'gmail_connected' | 'campaign_launched' | 'first_email_approved' | 'first_reply_received' | 'first_meeting_booked'
  occurred_at: string | null
}

export type HealthStatus = 'healthy' | 'at_risk' | 'critical'

export type CustomerHealth = {
  adoption_score: number
  success_score: number
  risk_score: number
  health_status: HealthStatus
}

export type BusinessOutcomes = {
  meetings_booked: number
  opportunities_created: number
  positive_replies: number
  pipeline_generated: number
}

export type RevenueEventType = 'trial_started' | 'subscription_started' | 'subscription_cancelled' | 'upgrade' | 'downgrade'

export type RevenueEvent = {
  id: string
  organization_id: string
  event_type: RevenueEventType
  amount: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  organizations?: Pick<Organization, 'id' | 'name'>
}

export type RevenueMetrics = {
  mrr: number
  arr: number
  active_customers: number
  churned_last_30d: number
  churn_rate_pct: number
}

export type ConversationCategory = 'question' | 'bug' | 'feature_request'
export type ConversationStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent'

export type SupportConversation = {
  id: string
  organization_id: string | null
  user_id: string
  subject: string
  category: ConversationCategory
  status: ConversationStatus
  priority: ConversationPriority
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'full_name'>
  organizations?: Pick<Organization, 'id' | 'name'>
}

export type SupportMessageSenderRole = 'user' | 'admin'

export type SupportMessage = {
  id: string
  conversation_id: string
  sender_id: string
  sender_role: SupportMessageSenderRole
  body: string
  created_at: string
}

export type DesignPartnerReportContent = {
  adoption_score: number
  success_score: number
  risk_score: number
  health_status: HealthStatus
  leads_found: number
  emails_sent: number
  replies_received: number
  journey: JourneyMilestone[]
  requested_features: string | null
  complaints_this_period: number
  blockers_this_period: { reason: string | null; message: string }[]
}

export type DesignPartnerReport = {
  id: string
  organization_id: string
  period_start: string
  period_end: string
  content: DesignPartnerReportContent
  generated_by: string | null
  created_at: string
}

export type DesignPartnerCohortRow = {
  organization_id: string
  organization_name: string
  organizations_created: number
  campaigns_launched: number
  emails_sent: number
  replies_received: number
  meetings_booked: number
}

export type ProspectPipeline = {
  discovered: number
  enriched: number
  contacted: number
  responded: number
  meeting_booked: number
}

export type EmailQueue = {
  pending_approval: number
  approved: number
  sent: number
  replied: number
}

export type ProductAnalyticsFunnel = {
  signups: number
  onboarding_completion: number
  gmail_connections: number
  campaign_launches: number
  first_email_sent: number
  first_reply_received: number
  first_meeting_booked: number
}

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4

export type OrganizationExecutive = {
  organization_id: string
  autonomy_level: AutonomyLevel
  default_subject_line: string | null
  created_at: string
  updated_at: string
}

export type IcpResultContent = {
  icp: { targetIndustry: string | null; companySize: string | null; location: string | null; icpDescription: string | null; setAt: string }
  period_start: string
  period_end: string
  leads_found: number
  emails_sent: number
  replies_received: number
  meetings_booked: number
  reply_rate: number | null
}

export type OrganizationMemory = {
  id: string
  organization_id: string
  memory_type: 'icp_result' | 'lesson_learned'
  content: IcpResultContent | Record<string, unknown>
  created_at: string
}

export type ExecutiveBriefPeriod = 'daily' | 'weekly' | 'monthly'

export type ExecutiveBriefContent = {
  what_happened: string[]
  what_worked: string[]
  what_failed: string[]
  what_changed: string[]
  needs_attention: string[]
  recommended_actions: string[]
}

export type ExecutiveBrief = {
  id: string
  organization_id: string
  period_type: ExecutiveBriefPeriod
  period_start: string
  period_end: string
  content: ExecutiveBriefContent
  generated_by: string | null
  created_at: string
}

export type ExperimentVariant = {
  subject_line: string
  sent?: number
  replies?: number
  reply_rate?: number
}

export type ExperimentStatus = 'running' | 'concluded'
export type ExperimentWinner = 'a' | 'b' | 'tie'

export type Experiment = {
  id: string
  organization_id: string
  goal_id: string | null
  experiment_type: 'subject_line'
  variant_a: ExperimentVariant
  variant_b: ExperimentVariant
  status: ExperimentStatus
  winner: ExperimentWinner | null
  started_at: string
  concluded_at: string | null
  created_by: string | null
}

export type KnowledgeGraph = {
  nodes: {
    goals: number
    agents: number
    tasks: number
    meetings: number
    experiments: number
  }
  edges: {
    goal_to_agent: { goal: string; agent: string }[]
    agent_to_outcome: { agent: string; outcome: string }[]
  }
}

export type PerformanceIntelligence = {
  best_icp: { icp: IcpResultContent['icp']; reply_rate: number; meetings_booked: number } | null
  best_message: { subject_line: string; reply_rate: string } | null
  best_agent: { agent_name: string; meetings_booked: number; emails_sent: number } | null
}

export type JobType = 'check_replies' | 'sync_crm' | 'generate_brief' | 'evaluate_experiment' | 'health_check' | 'progress_campaign' | 'compute_daily_rollup'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'cancelled'

export type Job = {
  id: string
  organization_id: string | null
  job_type: JobType
  payload: Record<string, unknown>
  status: JobStatus
  priority: number
  attempts: number
  scheduled_for: string
  created_by: string | null
  created_at: string
  updated_at: string
  organizations?: Pick<Organization, 'id' | 'name'>
}

export type JobFailure = {
  id: string
  job_id: string
  run_id: string | null
  organization_id: string | null
  job_type: JobType
  error_message: string
  will_retry: boolean
  resolved: boolean
  created_at: string
  organizations?: Pick<Organization, 'id' | 'name'>
}

export type ReplyClassificationType = 'interested' | 'not_interested' | 'unsubscribe' | 'objection' | 'meeting_request' | 'referral' | 'wrong_contact'

export type ReplyClassification = {
  id: string
  organization_id: string
  sales_activity_id: string | null
  contact_email: string
  contact_name: string | null
  classification: ReplyClassificationType
  confidence: number | null
  reasoning: string | null
  action_items: string[]
  created_at: string
}

export type NextBestAction = {
  contact_email: string
  contact_name: string | null
  classification: ReplyClassificationType
  days_since: number
  suggested_action: string
}

export type Opportunities = {
  stalled_campaign: boolean
  high_value_prospects: { contact_email: string; contact_name: string | null; estimated_value: number }[]
  winning_icp: IcpResultContent['icp'] | null
  failing_icp: IcpResultContent['icp'] | null
}

export type DealOutcome = 'won' | 'lost'

export type RevenueAttribution = {
  pipeline_open: number
  revenue_won: number
  revenue_lost: number
  by_icp: { industry: string; revenue_won: number }[]
  by_subject_line: { subject_line: string; revenue_won: number }[]
}

export type AuditLogEntry = {
  id: string
  organization_id: string | null
  actor_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  profiles?: Pick<Profile, 'id' | 'full_name'>
}

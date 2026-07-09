import { type ClassValue, clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatTimeAgo(date: string | null | undefined): string {
  if (!date) return ''
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return ''
  }
}

export function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getAgentStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'inactive': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    case 'suspended': return 'text-red-400 bg-red-400/10 border-red-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function formatCurrency(amount: number, currency: string = 'credits'): string {
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'credits' ? `${formatted} credits` : `${formatted} ${currency}`
}

export function getVerificationBadgeColor(level: number): string {
  switch (level) {
    case 4: return 'text-purple-300 bg-purple-500/15 border-purple-500/30'
    case 3: return 'text-blue-300 bg-blue-500/15 border-blue-500/30'
    case 2: return 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30'
    case 1: return 'text-green-300 bg-green-500/15 border-green-500/30'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getTrustScoreColor(score: number): string {
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  if (score >= 25) return 'text-orange-400'
  return 'text-gray-400'
}

export function getActivityIcon(type: string): string {
  switch (type) {
    case 'credential_earned': return '📜'
    case 'verification_earned': return '✅'
    case 'rating_received': return '⭐'
    case 'project_added': return '📁'
    case 'profile_updated': return '✏️'
    default: return '•'
  }
}

export function getActivityLabel(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'credential_earned': return `Earned credential "${payload.title ?? ''}"`
    case 'verification_earned': return `Reached verification level ${payload.level ?? ''}`
    case 'rating_received': return `Received a ${payload.score ?? ''}-star rating`
    case 'project_added': return `Added project "${payload.title ?? ''}"`
    case 'profile_updated': return 'Updated profile'
    default: return 'Activity'
  }
}

export function getAssignmentPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    case 'medium': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'low': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getAssignmentStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'paused': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'completed': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'removed': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getOrgActivityIcon(type: string): string {
  switch (type) {
    case 'member_joined': return '👋'
    case 'member_removed': return '🚪'
    case 'agent_joined': return '🤖'
    case 'agent_removed': return '📤'
    case 'department_created': return '🏢'
    case 'verification_earned': return '✅'
    case 'trust_score_changed': return '📈'
    case 'assignment_completed': return '✔️'
    case 'workflow_completed': return '🔁'
    case 'goal_created': return '🎯'
    case 'goal_completed': return '🏁'
    case 'goal_failed': return '⚠️'
    case 'plan_approved': return '📋'
    default: return '•'
  }
}

export function getOrgActivityLabel(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'member_joined': return 'A new member joined'
    case 'member_removed': return 'A member left'
    case 'agent_joined': return 'An agent joined the organization'
    case 'agent_removed': return 'An agent was removed'
    case 'department_created': return `Department "${payload.name ?? ''}" was created`
    case 'verification_earned': return `An agent reached verification level ${payload.level ?? ''}`
    case 'trust_score_changed': {
      const oldScore = Number(payload.old_score ?? 0)
      const newScore = Number(payload.new_score ?? 0)
      const direction = newScore >= oldScore ? 'up' : 'down'
      return `${payload.agent_name ?? 'An agent'}'s trust score moved ${direction} to ${newScore.toFixed(0)}`
    }
    case 'assignment_completed': return 'An assignment was completed'
    case 'workflow_completed': return 'A workflow run completed'
    case 'goal_created': return `Goal "${payload.title ?? ''}" was created`
    case 'goal_completed': return `Goal "${payload.title ?? ''}" was completed`
    case 'goal_failed': return `Goal "${payload.title ?? ''}" failed`
    case 'plan_approved': return 'A goal plan was approved'
    default: return 'Activity'
  }
}

export function getWorkflowStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'in_progress': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'cancelled': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    case 'pending': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getTaskStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    case 'assigned': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'in_progress': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
    case 'review': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getExecutionStatusColor(status: string): string {
  switch (status) {
    case 'queued': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    case 'running': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
    case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'cancelled': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getDecisionOutcomeColor(outcome: string): string {
  return outcome === 'yes' ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'
}

export function getGoalStatusColor(status: string): string {
  switch (status) {
    case 'draft': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    case 'active': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
    case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getPlanStatusColor(status: string): string {
  switch (status) {
    case 'draft': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    case 'approved': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
    case 'rejected': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getRiskScoreColor(score: number): string {
  if (score >= 66) return 'text-red-400'
  if (score >= 33) return 'text-yellow-400'
  return 'text-green-400'
}

export function getSimulationStatusColor(status: string): string {
  switch (status) {
    case 'running': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}

export function getTaskEventIcon(type: string): string {
  switch (type) {
    case 'created': return '🆕'
    case 'assigned': return '🎯'
    case 'started': return '▶️'
    case 'completed': return '✅'
    case 'reviewed': return '📝'
    case 'failed': return '❌'
    default: return '•'
  }
}

export function getTaskEventLabel(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'created': return `Task created: "${payload.title ?? ''}"`
    case 'assigned': return 'Assigned to an agent'
    case 'started': return 'Work started'
    case 'completed': return 'Task completed'
    case 'reviewed': return `Reviewed: ${payload.rating ?? ''}/5`
    case 'failed': return 'Task failed'
    default: return 'Event'
  }
}

export function getGrowthTrendColor(trend: string): string {
  switch (trend) {
    case 'improving': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'declining': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'stable': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getGrowthTrendIcon(trend: string): string {
  switch (trend) {
    case 'improving': return '📈'
    case 'declining': return '📉'
    case 'stable': return '➡️'
    default: return '❓'
  }
}

export function getRecommendationStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'approved': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'applied': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'rejected': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export function getIntegrationStatusColor(status: string): string {
  switch (status) {
    case 'connected': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'error': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'disconnected': return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function getSalesActivityIcon(type: string): string {
  switch (type) {
    case 'lead_found': return '🔎'
    case 'email_sent': return '📤'
    case 'reply_received': return '↩️'
    case 'meeting_booked': return '📅'
    default: return '•'
  }
}

export function getSalesActivityLabel(type: string): string {
  switch (type) {
    case 'lead_found': return 'Lead found'
    case 'email_sent': return 'Email sent'
    case 'reply_received': return 'Reply received'
    case 'meeting_booked': return 'Meeting booked'
    default: return 'Activity'
  }
}

// Shared by lib/runtime/salesActions.ts and lib/campaigns.ts — a single
// definition so a fix only has to happen once. The trailing TLD group
// uses `+` (one or more `.label` repeats), not a single `\.[a-z]{2,}` —
// the earlier single-group version silently truncated any multi-level
// TLD (acme.co.uk -> "acme.co", a different, often real, unrelated
// domain) and any www-prefixed domain (www.acme.com -> "www.acme", not
// even a valid hostname). A real design partner in the UK/Australia/etc.
// would have had their campaign silently target the wrong company.
const DOMAIN_PATTERN = /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,})+\b/gi

export function extractDomains(text: string): string[] {
  const matches = text.match(DOMAIN_PATTERN) || []
  const normalized = matches.map((m) => m.toLowerCase().replace(/^www\./, ''))
  return Array.from(new Set(normalized))
}

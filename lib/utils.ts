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

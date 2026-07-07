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

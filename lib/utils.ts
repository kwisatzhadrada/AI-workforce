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

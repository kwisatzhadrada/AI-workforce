import { HealthStatus } from '@/lib/types'

const COLOR: Record<HealthStatus, string> = {
  healthy: 'text-green-400 bg-green-400/10 border-green-400/20',
  at_risk: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const LABEL: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  at_risk: 'At Risk',
  critical: 'Critical',
}

export default function HealthBadge({ status }: { status: HealthStatus }) {
  return <span className={`text-xs px-2 py-0.5 rounded-md border ${COLOR[status]}`}>{LABEL[status]}</span>
}

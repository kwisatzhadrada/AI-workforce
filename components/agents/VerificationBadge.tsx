import { VERIFICATION_LEVEL_LABELS, VerificationLevel } from '@/lib/types'
import { getVerificationBadgeColor } from '@/lib/utils'

export default function VerificationBadge({ level, compact }: { level: VerificationLevel; compact?: boolean }) {
  if (level === 0 && compact) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${getVerificationBadgeColor(level)}`}>
      {level > 0 && '✓'} {compact ? `L${level}` : VERIFICATION_LEVEL_LABELS[level]}
    </span>
  )
}

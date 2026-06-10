import { getPlan } from '../lib/plans'
import type { PlanId } from '../types'

interface PlanBadgeProps {
  planId?: PlanId
  className?: string
}

export default function PlanBadge({ planId, className = '' }: PlanBadgeProps) {
  const plan = getPlan(planId)
  const isOg = plan.id === 'og'

  return (
    <span
      className={`px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase ${
        isOg
          ? 'bg-gradient-to-r from-amber-900/50 to-orange-900/40 text-amber-300 border border-amber-700/50'
          : 'bg-app-surface-active text-gray-400'
      } ${className}`}
    >
      {plan.label}
    </span>
  )
}

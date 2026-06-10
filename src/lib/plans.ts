import type { PlanId } from '../types'

export type { PlanId }

export interface PlanLimits {
  workspaces: number | null
  basesPerWorkspace: number | null
  tablesPerBase: number | null
  rowsPerTable: number | null
}

export interface Plan {
  id: PlanId
  label: string
  limits: PlanLimits
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    label: 'Free Plan',
    limits: {
      workspaces: 2,
      basesPerWorkspace: 3,
      tablesPerBase: 5,
      rowsPerTable: 1000,
    },
  },
  og: {
    id: 'og',
    label: 'OG PLAN ∞',
    limits: {
      workspaces: null,
      basesPerWorkspace: null,
      tablesPerBase: null,
      rowsPerTable: null,
    },
  },
}

export function getPlan(planId?: PlanId): Plan {
  return PLANS[planId ?? 'free']
}

export function isUnlimited(limit: number | null): boolean {
  return limit === null
}

export function isWithinLimit(current: number, limit: number | null): boolean {
  if (limit === null) return true
  return current < limit
}

export function formatLimit(limit: number | null): string {
  return limit === null ? '∞' : String(limit)
}

export const PLAN_OPTIONS = Object.values(PLANS)

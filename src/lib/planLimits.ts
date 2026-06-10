import type { PlanId } from '../types'
import { getPlan, isWithinLimit } from './plans'
import { getBases, getUserWorkspaces, getWorkspaceBases } from './storage'

export function canCreateWorkspace(userId: string, email: string, planId?: PlanId) {
  const limit = getPlan(planId).limits.workspaces
  const count = getUserWorkspaces(userId, email).filter((w) => w.ownerId === userId).length
  if (isWithinLimit(count, limit)) return { ok: true as const }
  return {
    ok: false as const,
    error: `Workspace limit reached (${limit}). Upgrade your plan for more.`,
  }
}

export function canCreateBase(workspaceId: string, planId?: PlanId) {
  const limit = getPlan(planId).limits.basesPerWorkspace
  const count = getWorkspaceBases(workspaceId).length
  if (isWithinLimit(count, limit)) return { ok: true as const }
  return {
    ok: false as const,
    error: `Base limit reached (${limit}). Upgrade your plan for more.`,
  }
}

export function canAddTables(currentTableCount: number, adding: number, planId?: PlanId) {
  const limit = getPlan(planId).limits.tablesPerBase
  if (isWithinLimit(currentTableCount + adding - 1, limit)) return { ok: true as const }
  return {
    ok: false as const,
    error: `Table limit reached (${limit}). Upgrade your plan for more.`,
  }
}

export function canAddRows(currentRowCount: number, adding: number, planId?: PlanId) {
  const limit = getPlan(planId).limits.rowsPerTable
  if (isWithinLimit(currentRowCount + adding - 1, limit)) return { ok: true as const }
  return {
    ok: false as const,
    error: `Row limit reached (${limit}). Upgrade your plan for more.`,
  }
}

export function countUserBases(userId: string): number {
  return getBases().filter((b) => b.userId === userId).length
}

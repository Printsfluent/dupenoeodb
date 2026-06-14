import type { Base } from '../types'

export function baseUpdatedAt(base: Base): number {
  const stamp = base.updatedAt ?? base.createdAt ?? ''
  const parsed = Date.parse(stamp)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function isBaseNewer(a: Base, b: Base): boolean {
  return baseUpdatedAt(a) > baseUpdatedAt(b)
}

export function stampBase(base: Base): Base {
  return { ...base, updatedAt: new Date().toISOString() }
}

import { normalizeBase } from './tableSchema'
import { isBaseNewer } from './baseUpdated'
import type { Base, Table } from '../types'

export function countBaseRows(base: Base): number {
  return (base.tables ?? []).reduce((sum, table) => sum + (table.rows?.length ?? 0), 0)
}

export function countAllBaseRows(bases: Base[]): number {
  return bases.reduce((sum, base) => sum + countBaseRows(base), 0)
}

/** Keep winner rows intact; only append rows that exist on the other copy. Never blend cell values. */
function unionTableRows(winner: Table, other: Table): Table {
  const winnerRowIds = new Set(winner.rows.map((row) => row.id))
  const extraRows = other.rows.filter((row) => !winnerRowIds.has(row.id))

  const columnById = new Map(winner.columns.map((col) => [col.id, col]))
  other.columns.forEach((col) => {
    if (!columnById.has(col.id)) columnById.set(col.id, col)
  })

  return {
    ...winner,
    columns: Array.from(columnById.values()),
    rows: extraRows.length ? [...winner.rows, ...extraRows] : winner.rows,
  }
}

function unionTables(winnerTables: Table[], otherTables: Table[]): Table[] {
  const otherById = new Map(otherTables.map((table) => [table.id, table]))
  const winnerById = new Map(winnerTables.map((table) => [table.id, table]))
  const ids = new Set([...winnerById.keys(), ...otherById.keys()])

  return Array.from(ids).map((id) => {
    const winner = winnerById.get(id)
    const other = otherById.get(id)
    if (winner && other) return unionTableRows(winner, other)
    return (winner ?? other)!
  })
}

/**
 * Resolve two versions of the same base without mixing cell values on shared rows.
 * The newer copy wins for overlapping rows; rows only present in the other copy are kept.
 */
export function resolveBaseConflict(a: Base, b: Base): Base {
  const local = normalizeBase(a)
  const remote = normalizeBase(b)

  if (isBaseNewer(local, remote) && !isBaseNewer(remote, local)) {
    return { ...local, tables: unionTables(local.tables, remote.tables) }
  }
  if (isBaseNewer(remote, local) && !isBaseNewer(local, remote)) {
    return { ...remote, tables: unionTables(remote.tables, local.tables) }
  }

  const localRows = countBaseRows(local)
  const remoteRows = countBaseRows(remote)
  const preferLocal = localRows >= remoteRows
  const winner = preferLocal ? local : remote
  const loser = preferLocal ? remote : local

  return {
    ...winner,
    tables: unionTables(winner.tables, loser.tables),
    updatedAt: winner.updatedAt ?? loser.updatedAt,
  }
}

/** @deprecated Use resolveBaseConflict — kept for existing call sites. */
export function pickRicherBase(local: Base, remote: Base): Base {
  return resolveBaseConflict(local, remote)
}

/** Merge two base lists by id, keeping the newest intact row data for each database. */
export function mergeBasesList(primary: Base[], secondary: Base[]): Base[] {
  const primaryById = new Map(primary.map((base) => [base.id, normalizeBase(base)]))
  const secondaryById = new Map(secondary.map((base) => [base.id, normalizeBase(base)]))
  const ids = new Set([...primaryById.keys(), ...secondaryById.keys()])

  return Array.from(ids).map((id) => {
    const a = primaryById.get(id)
    const b = secondaryById.get(id)
    if (a && b) return resolveBaseConflict(a, b)
    return (a ?? b)!
  })
}

/**
 * Merge incoming Firestore bases with cached bases for a workspace.
 * Returns bases that should be pushed back to the cloud because local data was richer.
 */
export function mergeWorkspaceBases(workspaceId: string, existing: Base[], incoming: Base[]) {
  const local = existing
    .filter((base) => base.workspaceId === workspaceId)
    .map(normalizeBase)
  const localById = new Map(local.map((base) => [base.id, base]))
  const remote = incoming.map(normalizeBase)
  const remoteIds = new Set(remote.map((base) => base.id))
  const needsCloudSync: Base[] = []

  const merged = remote.map((remoteBase) => {
    const localBase = localById.get(remoteBase.id)
    if (!localBase) return remoteBase
    if (isBaseNewer(localBase, remoteBase)) {
      needsCloudSync.push(localBase)
      return localBase
    }
    if (isBaseNewer(remoteBase, localBase)) {
      return remoteBase
    }

    const resolved = resolveBaseConflict(localBase, remoteBase)
    const localRows = countBaseRows(localBase)
    const remoteRows = countBaseRows(remoteBase)
    if (localRows > remoteRows || countBaseRows(resolved) > remoteRows) {
      needsCloudSync.push(resolved)
    }
    return resolved
  })

  const localOnly = local.filter((base) => !remoteIds.has(base.id))
  localOnly.forEach((base) => needsCloudSync.push(base))

  const result = [
    ...existing.filter((base) => base.workspaceId !== workspaceId),
    ...merged,
    ...localOnly,
  ]

  return { bases: result, needsCloudSync }
}

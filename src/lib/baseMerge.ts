import { normalizeBase } from './tableSchema'
import { isBaseNewer, baseUpdatedAt } from './baseUpdated'
import type { Base, Table } from '../types'

export function countBaseRows(base: Base): number {
  return (base.tables ?? []).reduce((sum, table) => sum + (table.rows?.length ?? 0), 0)
}

export function countAllBaseRows(bases: Base[]): number {
  return bases.reduce((sum, base) => sum + countBaseRows(base), 0)
}

/** Keep winner rows intact; only append rows that exist on the other copy. Never blend cell values or resurrect deleted columns. */
function unionTableRows(winner: Table, other: Table): Table {
  const winnerRowIds = new Set(winner.rows.map((row) => row.id))
  const extraRows = other.rows.filter((row) => !winnerRowIds.has(row.id))

  return {
    ...winner,
    columns: winner.columns,
    rows: extraRows.length ? [...winner.rows, ...extraRows] : winner.rows,
  }
}

/** Merge row data for tables present in winner; tables removed from winner stay removed. */
function mergeTablesFromWinner(winnerTables: Table[], otherTables: Table[]): Table[] {
  const otherById = new Map(otherTables.map((table) => [table.id, table]))
  return winnerTables.map((winnerTable) => {
    const other = otherById.get(winnerTable.id)
    return other ? unionTableRows(winnerTable, other) : winnerTable
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
    return { ...local, tables: mergeTablesFromWinner(local.tables, remote.tables) }
  }
  if (isBaseNewer(remote, local) && !isBaseNewer(local, remote)) {
    return { ...remote, tables: mergeTablesFromWinner(remote.tables, local.tables) }
  }

  // Equal timestamps — prefer local so intentional deletes are not resurrected.
  return { ...local, tables: mergeTablesFromWinner(local.tables, remote.tables) }
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

    const resolved = resolveBaseConflict(localBase, remoteBase)
    if (isBaseNewer(localBase, remoteBase) && !isBaseNewer(remoteBase, localBase)) {
      needsCloudSync.push(resolved)
    } else if (baseUpdatedAt(localBase) === baseUpdatedAt(remoteBase)) {
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

import { normalizeBase } from './tableSchema'
import { isBaseNewer } from './baseUpdated'
import type { Base, Row, Table } from '../types'

export function countBaseRows(base: Base): number {
  return (base.tables ?? []).reduce((sum, table) => sum + (table.rows?.length ?? 0), 0)
}

export function countAllBaseRows(bases: Base[]): number {
  return bases.reduce((sum, base) => sum + countBaseRows(base), 0)
}

function mergeRowCells(primary: Row, secondary: Row): Row {
  const cells = { ...primary.cells }
  for (const [colId, value] of Object.entries(secondary.cells)) {
    const current = cells[colId] ?? ''
    if (!current && value) {
      cells[colId] = value
    } else if (value && value.length > current.length) {
      cells[colId] = value
    }
  }
  return { id: primary.id, cells }
}

function mergeTable(local: Table, remote: Table): Table {
  const rowById = new Map<string, Row>()
  remote.rows.forEach((row) => rowById.set(row.id, row))
  local.rows.forEach((row) => {
    const existing = rowById.get(row.id)
    rowById.set(row.id, existing ? mergeRowCells(existing, row) : row)
  })

  const columnById = new Map(remote.columns.map((col) => [col.id, col]))
  local.columns.forEach((col) => {
    if (!columnById.has(col.id)) columnById.set(col.id, col)
  })

  return {
    ...remote,
    ...local,
    columns: Array.from(columnById.values()),
    rows: Array.from(rowById.values()),
  }
}

function mergeTables(localTables: Table[], remoteTables: Table[]): Table[] {
  const remoteById = new Map(remoteTables.map((table) => [table.id, table]))
  const localById = new Map(localTables.map((table) => [table.id, table]))
  const ids = new Set([...remoteById.keys(), ...localById.keys()])

  return Array.from(ids).map((id) => {
    const local = localById.get(id)
    const remote = remoteById.get(id)
    if (local && remote) return mergeTable(local, remote)
    return (local ?? remote)!
  })
}

export function pickRicherBase(local: Base, remote: Base): Base {
  const normalizedLocal = normalizeBase(local)
  const normalizedRemote = normalizeBase(remote)
  const localRows = countBaseRows(normalizedLocal)
  const remoteRows = countBaseRows(normalizedRemote)

  if (localRows > remoteRows) {
    return {
      ...normalizedRemote,
      ...normalizedLocal,
      tables: mergeTables(normalizedLocal.tables, normalizedRemote.tables),
    }
  }

  if (remoteRows > localRows) {
    return {
      ...normalizedLocal,
      ...normalizedRemote,
      tables: mergeTables(normalizedLocal.tables, normalizedRemote.tables),
    }
  }

  return {
    ...normalizedLocal,
    ...normalizedRemote,
    tables: mergeTables(normalizedLocal.tables, normalizedRemote.tables),
  }
}

/** Merge two base lists by id, keeping the richest row data for each database. */
export function mergeBasesList(primary: Base[], secondary: Base[]): Base[] {
  const primaryById = new Map(primary.map((base) => [base.id, normalizeBase(base)]))
  const secondaryById = new Map(secondary.map((base) => [base.id, normalizeBase(base)]))
  const ids = new Set([...primaryById.keys(), ...secondaryById.keys()])

  return Array.from(ids).map((id) => {
    const a = primaryById.get(id)
    const b = secondaryById.get(id)
    if (a && b) return pickRicherBase(a, b)
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

    const picked = pickRicherBase(localBase, remoteBase)
    const localRows = countBaseRows(localBase)
    const remoteRows = countBaseRows(remoteBase)
    if (localRows > remoteRows || countBaseRows(picked) > remoteRows) {
      needsCloudSync.push(picked)
    }
    return picked
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

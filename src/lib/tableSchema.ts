import { normalizeTableIcon } from './tableIcons'
import type { Base, Column, Table } from '../types'

function columnStructureSignature(col: Column): string {
  return JSON.stringify({
    id: col.id,
    name: col.name,
    type: col.type,
    hidden: col.hidden ?? false,
    isDisplayValue: col.isDisplayValue ?? false,
    editPermission: col.editPermission ?? 'everyone',
    description: col.description ?? '',
    options: col.options ?? [],
    colorCodeOptions: col.colorCodeOptions ?? false,
    alphabetizeOptions: col.alphabetizeOptions ?? false,
    defaultValue: col.defaultValue ?? '',
  })
}

/** True when table name, teams, or column definitions changed (not row data). */
export function isTableStructureChange(before: Table, after: Table): boolean {
  if (before.name !== after.name) return true

  const beforeTeams = [...(before.teamIds ?? [])].sort().join('|')
  const afterTeams = [...(after.teamIds ?? [])].sort().join('|')
  if (beforeTeams !== afterTeams) return true

  if (before.columns.length !== after.columns.length) return true

  const beforeById = new Map(before.columns.map((col) => [col.id, col]))
  for (const col of after.columns) {
    const prev = beforeById.get(col.id)
    if (!prev) return true
    if (columnStructureSignature(prev) !== columnStructureSignature(col)) return true
  }

  return false
}

/** Normalize legacy bases/tables loaded from Firestore or local storage. */
export function normalizeBase(base: Base): Base {
  return {
    ...base,
    icon: normalizeTableIcon(base.icon) ?? null,
    teamIds: base.teamIds ?? [],
    tables: (base.tables ?? []).map((table) => normalizeTable(table)),
  }
}

export function normalizeTable(table: Table): Table {
  return {
    ...table,
    icon: normalizeTableIcon(table.icon) ?? null,
    teamIds: table.teamIds ?? [],
    columns: (table.columns ?? []).map((col) => ({
      ...col,
      editPermission: col.editPermission ?? 'everyone',
    })),
    rows: table.rows ?? [],
  }
}

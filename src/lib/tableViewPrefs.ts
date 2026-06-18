import type { TableViewType } from '../types'

const KEY_PREFIX = 'sheetflow-view'

export function loadTableView(baseId: string, tableId: string): TableViewType {
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}:${baseId}:${tableId}`)
    if (raw === 'grid' || raw === 'gallery' || raw === 'kanban' || raw === 'calendar') return raw
  } catch {
    /* ignore */
  }
  return 'grid'
}

export function saveTableView(baseId: string, tableId: string, view: TableViewType) {
  try {
    sessionStorage.setItem(`${KEY_PREFIX}:${baseId}:${tableId}`, view)
  } catch {
    /* ignore */
  }
}

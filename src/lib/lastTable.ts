import { safeWriteJson } from './safeStorage'

const KEY = 'sheetflow_last_table_by_base'

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function rememberLastTable(baseId: string, tableId: string) {
  if (!baseId || !tableId) return
  const map = readMap()
  if (map[baseId] === tableId) return
  map[baseId] = tableId
  safeWriteJson(KEY, map)
}

export function getLastTableForBase(baseId: string): string | null {
  return readMap()[baseId] ?? null
}

export function baseUrl(workspaceId: string, baseId: string): string {
  const tableId = getLastTableForBase(baseId)
  const path = `/app/w/${workspaceId}/bases/${baseId}`
  return tableId ? `${path}?table=${tableId}` : path
}

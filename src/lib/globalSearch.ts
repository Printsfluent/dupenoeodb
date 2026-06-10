import { getCache } from './dataStore'

export interface SearchResult {
  id: string
  type: 'workspace' | 'database' | 'table' | 'record'
  label: string
  subtitle: string
  href: string
}

export function globalSearch(query: string, workspaceIds: string[]): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q || q.length < 2) return []

  const cache = getCache()
  const allowed = new Set(workspaceIds)
  const results: SearchResult[] = []

  cache.workspaces
    .filter((ws) => allowed.has(ws.id) && ws.name.toLowerCase().includes(q))
    .forEach((ws) => {
      results.push({
        id: `ws-${ws.id}`,
        type: 'workspace',
        label: ws.name,
        subtitle: 'Workspace',
        href: `/app/w/${ws.id}`,
      })
    })

  cache.bases
    .filter((db) => allowed.has(db.workspaceId) && db.name.toLowerCase().includes(q))
    .forEach((db) => {
      results.push({
        id: `db-${db.id}`,
        type: 'database',
        label: db.name,
        subtitle: 'Database',
        href: `/app/w/${db.workspaceId}/bases/${db.id}`,
      })
    })

  cache.bases
    .filter((db) => allowed.has(db.workspaceId))
    .forEach((db) => {
      db.tables.forEach((table) => {
        if (!table.name.toLowerCase().includes(q)) return
        results.push({
          id: `tbl-${table.id}`,
          type: 'table',
          label: table.name,
          subtitle: `${db.name} · Table`,
          href: `/app/w/${db.workspaceId}/bases/${db.id}?table=${table.id}`,
        })
      })
    })

  cache.bases
    .filter((db) => allowed.has(db.workspaceId))
    .forEach((db) => {
      db.tables.forEach((table) => {
        table.rows.forEach((row) => {
          const cellText = Object.values(row.cells).join(' ').toLowerCase()
          if (!cellText.includes(q)) return
          const preview = Object.values(row.cells).find((v) => v?.toLowerCase().includes(q))
          results.push({
            id: `row-${row.id}`,
            type: 'record',
            label: preview?.slice(0, 60) || row.id.slice(0, 8),
            subtitle: `${table.name} · Record`,
            href: `/app/w/${db.workspaceId}/bases/${db.id}?table=${table.id}`,
          })
        })
      })
    })

  return results.slice(0, 20)
}

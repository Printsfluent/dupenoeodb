import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Database, Table2, LayoutGrid, FileText } from 'lucide-react'
import { globalSearch, type SearchResult } from '../lib/globalSearch'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const typeIcons = {
  workspace: LayoutGrid,
  database: Database,
  table: Table2,
  record: FileText,
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { workspaceIds, cacheVersion } = useData()
  const [query, setQuery] = useState('')

  const results = useMemo(
    () => globalSearch(query, workspaceIds, user?.userId, user?.email),
    [query, workspaceIds, cacheVersion, user?.userId, user?.email],
  )

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function go(result: SearchResult) {
    navigate(result.href)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close search"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-app-border bg-app-surface shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border">
          <Search className="w-4 h-4 text-app-faint shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces, databases, tables, records…"
            className="flex-1 bg-transparent text-sm text-app-text placeholder:text-app-faint focus:outline-none"
          />
          <kbd className="hidden sm:inline text-[10px] text-app-faint border border-app-border rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {query.length < 2 ? (
            <li className="px-4 py-8 text-center text-sm text-app-faint">
              Type at least 2 characters to search
            </li>
          ) : results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-app-faint">No results</li>
          ) : (
            results.map((result) => {
              const Icon = typeIcons[result.type]
              return (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => go(result)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-app-surface-hover"
                  >
                    <Icon className="w-4 h-4 text-app-faint shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-app-text truncate">{result.label}</p>
                      <p className="text-xs text-app-faint truncate">{result.subtitle}</p>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}

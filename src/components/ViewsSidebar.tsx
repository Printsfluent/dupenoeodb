import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Image, Search, Table2 } from 'lucide-react'
import type { TableViewType } from '../types'

interface ViewOption {
  type: TableViewType
  label: string
  icon: typeof Table2
}

const VIEW_OPTIONS: ViewOption[] = [
  { type: 'grid', label: 'Grid view', icon: Table2 },
  { type: 'gallery', label: 'Gallery', icon: Image },
]

interface ViewsSidebarProps {
  activeView: TableViewType
  onViewChange: (view: TableViewType) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

export default function ViewsSidebar({
  activeView,
  onViewChange,
  collapsed,
  onToggleCollapsed,
}: ViewsSidebarProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return VIEW_OPTIONS
    return VIEW_OPTIONS.filter((view) => view.label.toLowerCase().includes(q))
  }, [query])

  if (collapsed) {
    return (
      <aside className="shrink-0 w-10 border-r border-app-border bg-app-surface flex flex-col items-center py-3 gap-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-1.5 rounded-lg text-app-faint hover:text-app-text hover:bg-app-surface-active transition-colors"
          title="Expand views"
          aria-label="Expand views sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {VIEW_OPTIONS.map((view) => {
          const Icon = view.icon
          const active = activeView === view.type
          return (
            <button
              key={view.type}
              type="button"
              onClick={() => onViewChange(view.type)}
              className={`p-1.5 rounded-lg transition-colors ${
                active
                  ? 'bg-brand-500/15 text-brand-500'
                  : 'text-app-faint hover:text-app-text hover:bg-app-surface-active'
              }`}
              title={view.label}
              aria-label={view.label}
            >
              <Icon className="w-4 h-4" />
            </button>
          )
        })}
      </aside>
    )
  }

  return (
    <aside className="shrink-0 w-[220px] border-r border-app-border bg-app-surface flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-app-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-app-faint">Views</span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-1 rounded text-app-faint hover:text-app-text hover:bg-app-surface-active transition-colors"
          title="Collapse views"
          aria-label="Collapse views sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 py-2.5 border-b border-app-border">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-app-border bg-app-bg">
          <Search className="w-3.5 h-3.5 text-app-faint shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a view"
            className="w-full bg-transparent text-sm text-app-text outline-none placeholder:text-app-faint"
            aria-label="Find a view"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {filtered.map((view) => {
          const Icon = view.icon
          const active = activeView === view.type
          return (
            <button
              key={view.type}
              type="button"
              onClick={() => onViewChange(view.type)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${
                active
                  ? 'bg-brand-500/12 text-brand-500 font-medium'
                  : 'text-app-text hover:bg-app-surface-active'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{view.label}</span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-app-faint">No views match your search.</p>
        )}
      </nav>
    </aside>
  )
}

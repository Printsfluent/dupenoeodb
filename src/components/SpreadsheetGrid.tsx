import { useState, useRef, useMemo, useEffect } from 'react'
import { Plus, Trash2, Columns3, ChevronDown, Eye, X, Star, Pencil, Users, Download, Search } from 'lucide-react'
import type { Column, ColumnType, Row, Table } from '../types'
import { createId } from '../lib/id'
import FieldContextMenu from './FieldContextMenu'
import FieldModal from './FieldModal'
import CellValueDisplay from './CellValueDisplay'
import CellValueEditor, { RatingInput, getCellInteraction } from './CellValueEditor'
import { isSelectFieldType, normalizeColumnType } from '../lib/fieldTypes'
import { createSelectOption, getDefaultCellValue, findSelectOption, parseMultiSelectValue } from '../lib/selectOptions'
import { extractLinkHref, openLink } from '../lib/links'
import { copyToClipboard } from '../lib/copy'
import { downloadTableAsCsv, downloadTableAsXlsx } from '../lib/exportSpreadsheet'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'

const ROW_INDEX_WIDTH_PX = 40

interface SpreadsheetGridProps {
  table: Table
  onChange: (table: Table) => void
  dark?: boolean
  readOnly?: boolean
  canEditFields?: boolean
  canModifySchema?: boolean
  isWorkspaceAdmin?: boolean
  onManageTableTeams?: () => void
  tableTeamCount?: number
  onAddRow?: () => boolean
}

type SortDirection = 'asc' | 'desc'

interface ViewState {
  sortColumnId: string | null
  sortDirection: SortDirection
  filterColumnId: string | null
  filterValue: string
  groupColumnId: string | null
  showHidden: boolean
  searchQuery: string
}

export default function SpreadsheetGrid({
  table,
  onChange,
  dark: darkProp,
  readOnly = false,
  canEditFields = false,
  canModifySchema = false,
  isWorkspaceAdmin = false,
  onManageTableTeams,
  tableTeamCount = 0,
  onAddRow,
}: SpreadsheetGridProps) {
  const { theme } = useTheme()
  const { success } = useToast()
  const notify = (message: string) => success(message, 'left')
  const dark = darkProp ?? theme === 'dark'
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [fieldMenu, setFieldMenu] = useState<{ columnId: string; rect: DOMRect } | null>(null)
  const [fieldModal, setFieldModal] = useState<{
    columnId: string
    mode: 'edit' | 'description' | 'permissions' | 'filter'
  } | null>(null)
  const [view, setView] = useState<ViewState>({
    sortColumnId: null,
    sortDirection: 'asc',
    filterColumnId: null,
    filterValue: '',
    groupColumnId: null,
    showHidden: false,
    searchQuery: '',
  })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const headerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const gridRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  function syncHeaderScroll() {
    if (headerScrollRef.current && gridRef.current) {
      headerScrollRef.current.scrollLeft = gridRef.current.scrollLeft
    }
  }

  const visibleColumns = useMemo(
    () => table.columns.filter((col) => view.showHidden || !col.hidden),
    [table.columns, view.showHidden],
  )

  const pinnedColumnId = useMemo(() => {
    const display = visibleColumns.find((col) => col.isDisplayValue)
    if (display) return display.id
    const named = visibleColumns.find((col) => {
      const n = col.name.trim().toLowerCase()
      return n === 'username' || n === 'user name' || n === 'title' || n === 'name'
    })
    return named?.id ?? visibleColumns[0]?.id ?? null
  }, [visibleColumns])

  const hiddenCount = table.columns.filter((col) => col.hidden).length
  const schemaEditable = canEditFields && canModifySchema

  function updateColumns(columns: Column[]) {
    if (!schemaEditable) return
    onChange({ ...table, columns })
  }

  function updateColumn(colId: string, patch: Partial<Column>) {
    if (!schemaEditable) return
    updateColumns(table.columns.map((col) => (col.id === colId ? { ...col, ...patch } : col)))
  }

  function updateCell(rowId: string, colId: string, value: string) {
    onChange({
      ...table,
      rows: table.rows.map((row) =>
        row.id === rowId ? { ...row, cells: { ...row.cells, [colId]: value } } : row,
      ),
    })
  }

  function getNextAutoNumber(colId: string) {
    const nums = table.rows
      .map((row) => parseInt(row.cells[colId] ?? '', 10))
      .filter((n) => !Number.isNaN(n))
    return String(nums.length ? Math.max(...nums) + 1 : 1)
  }

  function addRow() {
    if (onAddRow && !onAddRow()) return
    const cells: Record<string, string> = {}
    table.columns.forEach((col) => {
      if (normalizeColumnType(col.type) === 'autoNumber') {
        cells[col.id] = getNextAutoNumber(col.id)
      } else if (isSelectFieldType(col.type)) {
        cells[col.id] = getDefaultCellValue(col)
      } else {
        cells[col.id] = ''
      }
    })
    onChange({
      ...table,
      rows: [...table.rows, { id: createId(), cells }],
    })
  }

  function canEditCell(col: Column): boolean {
    if (readOnly) return false
    if (col.editPermission === 'creators_only' && !isWorkspaceAdmin) return false
    return true
  }

  function activateCellEdit(row: Row, col: Column) {
    if (!canEditCell(col)) return
    const interaction = getCellInteraction(col.type)
    if (interaction === 'readonly' || interaction === 'inline-rating') return
    setSelectedCell({ rowId: row.id, colId: col.id })
    setEditingCell({ rowId: row.id, colId: col.id })
  }

  function selectCell(row: Row, col: Column) {
    setSelectedCell({ rowId: row.id, colId: col.id })
    setEditingCell(null)
  }

  function handleCellClick(row: Row, col: Column, value: string, e?: React.MouseEvent) {
    if (!canEditCell(col)) {
      selectCell(row, col)
      return
    }

    if (e && (e.metaKey || e.ctrlKey) && extractLinkHref(value)) {
      openLink(value)
      return
    }

    const interaction = getCellInteraction(col.type)
    if (interaction === 'toggle') {
      const checked = value === 'true' || value === '1' || value.toLowerCase() === 'yes'
      updateCell(row.id, col.id, checked ? '' : 'true')
      selectCell(row, col)
      return
    }
    if (interaction === 'readonly' || interaction === 'inline-rating') {
      selectCell(row, col)
      return
    }

    selectCell(row, col)
    activateCellEdit(row, col)
  }

  function handleCellDoubleClick(row: Row, col: Column) {
    if (!canEditCell(col)) return
    activateCellEdit(row, col)
  }

  function cellAcceptsDirectInput(col: Column) {
    if (!canEditCell(col)) return false
    const interaction = getCellInteraction(col.type)
    return interaction === 'edit' || interaction === 'select'
  }

  function resolvePastedValue(col: Column, pasted: string): string {
    const trimmed = pasted.trim()
    if (!isSelectFieldType(col.type)) return trimmed
    const option = findSelectOption(col.options ?? [], trimmed)
    if (option) return option.id
    if (normalizeColumnType(col.type) === 'multiSelect') {
      const ids = trimmed.split(/[,|]/).map((part) => part.trim()).filter(Boolean)
      const resolved = ids.map((part) => findSelectOption(col.options ?? [], part)?.id ?? part)
      return resolved.length ? JSON.stringify(resolved) : ''
    }
    return trimmed
  }

  useEffect(() => {
    if (!selectedCell) return
    const active = selectedCell

    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const col = table.columns.find((item) => item.id === active.colId)
      if (!col || !cellAcceptsDirectInput(col)) return

      const pasted = e.clipboardData?.getData('text/plain')
      if (pasted === undefined) return

      e.preventDefault()
      updateCell(active.rowId, active.colId, resolvePastedValue(col, pasted))
      setEditingCell(null)
    }

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        const row = table.rows.find((item) => item.id === active.rowId)
        const value = row?.cells[active.colId] ?? ''
        if (value) {
          e.preventDefault()
          void copyToClipboard(value).then((ok) => {
            if (ok) notify('Copied')
          })
        }
        return
      }

      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault()
        const row = table.rows.find((item) => item.id === active.rowId)
        const col = table.columns.find((item) => item.id === active.colId)
        if (row && col) activateCellEdit(row, col)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const col = table.columns.find((item) => item.id === active.colId)
        if (col && canEditCell(col)) {
          e.preventDefault()
          updateCell(active.rowId, active.colId, '')
        }
        return
      }

      if (
        e.key.length === 1 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        const row = table.rows.find((item) => item.id === active.rowId)
        const col = table.columns.find((item) => item.id === active.colId)
        if (row && col && getCellInteraction(col.type) === 'edit') {
          e.preventDefault()
          setEditingCell({ rowId: active.rowId, colId: active.colId })
          updateCell(active.rowId, active.colId, e.key)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('paste', onPaste)
    }
  }, [selectedCell, table.rows, table.columns, readOnly, isWorkspaceAdmin])

  useEffect(() => {
    if (!showExportMenu) return
    function onPointerDown(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [showExportMenu])

  function deleteRow(rowId: string) {
    onChange({ ...table, rows: table.rows.filter((r) => r.id !== rowId) })
    notify('Row deleted')
  }

  function deleteColumn(colId: string) {
    if (!schemaEditable || table.columns.length <= 1) return
    const column = table.columns.find((col) => col.id === colId)
    onChange({
      ...table,
      columns: table.columns.filter((c) => c.id !== colId),
      rows: table.rows.map((row) => {
        const { [colId]: _removed, ...cells } = row.cells
        return { ...row, cells }
      }),
    })
    if (view.sortColumnId === colId) setView((v) => ({ ...v, sortColumnId: null }))
    if (view.filterColumnId === colId) setView((v) => ({ ...v, filterColumnId: null, filterValue: '' }))
    if (view.groupColumnId === colId) setView((v) => ({ ...v, groupColumnId: null }))
    notify(column ? `Column "${column.name}" deleted` : 'Column deleted')
  }

  function createColumn(name: string, type: ColumnType = 'singleLineText'): Column {
    return { id: createId(), name, type }
  }

  function addColumn() {
    if (!schemaEditable) return
    const col = createColumn(`Column ${table.columns.length + 1}`)
    onChange({
      ...table,
      columns: [...table.columns, col],
      rows: table.rows.map((row) => ({
        ...row,
        cells: { ...row.cells, [col.id]: '' },
      })),
    })
  }

  function insertColumn(anchorColId: string, side: 'left' | 'right') {
    if (!schemaEditable) return
    const index = table.columns.findIndex((col) => col.id === anchorColId)
    if (index === -1) return
    const col = createColumn(`Column ${table.columns.length + 1}`)
    const columns = [...table.columns]
    columns.splice(side === 'left' ? index : index + 1, 0, col)
    onChange({
      ...table,
      columns,
      rows: table.rows.map((row) => ({
        ...row,
        cells: { ...row.cells, [col.id]: '' },
      })),
    })
  }

  function duplicateColumn(colId: string) {
    if (!schemaEditable) return
    const source = table.columns.find((col) => col.id === colId)
    if (!source) return
    const index = table.columns.findIndex((col) => col.id === colId)
    const duplicate: Column = {
      ...source,
      id: createId(),
      name: `${source.name} copy`,
      isDisplayValue: false,
    }
    const columns = [...table.columns]
    columns.splice(index + 1, 0, duplicate)
    onChange({
      ...table,
      columns,
      rows: table.rows.map((row) => ({
        ...row,
        cells: { ...row.cells, [duplicate.id]: row.cells[colId] ?? '' },
      })),
    })
    notify(`Field "${source.name}" copied`)
  }

  function setDisplayValue(colId: string) {
    if (!schemaEditable) return
    updateColumns(
      table.columns.map((col) => ({
        ...col,
        isDisplayValue: col.id === colId,
      })),
    )
  }

  function sortRows(colId: string, direction: SortDirection) {
    setView((v) => ({ ...v, sortColumnId: colId, sortDirection: direction }))
  }

  function getSearchableCellText(row: Row, col: Column): string {
    const raw = row.cells[col.id] ?? ''
    const normalized = normalizeColumnType(col.type)
    if (normalized === 'singleSelect') {
      const option = findSelectOption(col.options ?? [], raw)
      return [raw, option?.label ?? ''].filter(Boolean).join(' ')
    }
    if (normalized === 'multiSelect') {
      const ids = parseMultiSelectValue(raw)
      const labels = ids.map((id) => findSelectOption(col.options ?? [], id)?.label ?? id)
      return [raw, ...labels].filter(Boolean).join(' ')
    }
    return raw
  }

  function rowMatchesSearch(row: Row, query: string) {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return visibleColumns.some((col) =>
      getSearchableCellText(row, col).toLowerCase().includes(q),
    )
  }

  function clearViewOverrides() {
    setView({
      sortColumnId: null,
      sortDirection: 'asc',
      filterColumnId: null,
      filterValue: '',
      groupColumnId: null,
      showHidden: view.showHidden,
      searchQuery: '',
    })
  }

  const processedRows = useMemo(() => {
    let rows = [...table.rows]

    if (view.filterColumnId && view.filterValue.trim()) {
      const q = view.filterValue.trim().toLowerCase()
      rows = rows.filter((row) =>
        (row.cells[view.filterColumnId!] ?? '').toLowerCase().includes(q),
      )
    }

    if (view.searchQuery.trim()) {
      rows = rows.filter((row) => rowMatchesSearch(row, view.searchQuery))
    }

    if (view.sortColumnId) {
      const colId = view.sortColumnId
      const dir = view.sortDirection === 'asc' ? 1 : -1
      rows.sort((a, b) => {
        const av = a.cells[colId] ?? ''
        const bv = b.cells[colId] ?? ''
        const an = Number(av)
        const bn = Number(bv)
        if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') {
          return (an - bn) * dir
        }
        return av.localeCompare(bv, undefined, { numeric: true }) * dir
      })
    }

    return rows
  }, [table.rows, view.filterColumnId, view.filterValue, view.searchQuery, view.sortColumnId, view.sortDirection, visibleColumns])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const groupedRows = useMemo(() => {
    if (!view.groupColumnId) return null
    const groups = new Map<string, Row[]>()
    processedRows.forEach((row) => {
      const key = row.cells[view.groupColumnId!] || ''
      const label = key || '(No value)'
      const list = groups.get(label) ?? []
      list.push(row)
      groups.set(label, list)
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [processedRows, view.groupColumnId])

  function openFieldMenu(colId: string) {
    if (!schemaEditable) return
    const el = headerRefs.current[colId]
    if (!el) return
    setFieldMenu({ columnId: colId, rect: el.getBoundingClientRect() })
  }

  function openEditField(colId: string) {
    if (!schemaEditable) return
    setFieldMenu(null)
    setFieldModal({ columnId: colId, mode: 'edit' })
  }

  const toolbar = 'border-app-border bg-app-surface'
  const addColBtn = 'text-app-faint hover:text-brand-500 hover:bg-app-surface-active'
  const thText = 'text-app-faint'
  const rowHover = 'hover:bg-app-surface-hover'
  const cellHover = 'hover:bg-app-surface-hover'
  const cellText = 'text-app-text'
  const emptyText = 'text-app-faint'
  const tableClass = 'w-full text-sm border-separate border-spacing-0 min-w-max'
  const cellDivider = 'border-r border-b border-app-border'
  const headBg = 'bg-app-surface-muted'
  const bodyBg = 'bg-app-bg'
  const activeColumn = fieldMenu
    ? table.columns.find((col) => col.id === fieldMenu.columnId)
    : null

  const modalColumn = fieldModal
    ? table.columns.find((col) => col.id === fieldModal.columnId)
    : null

  const stickyIndexClass = `sticky left-0 z-[20] ${bodyBg} ${cellDivider}`
  const stickyIndexHeadClass = `sticky left-0 z-[40] ${headBg} ${cellDivider}`
  const stickyPinnedStyle = { left: ROW_INDEX_WIDTH_PX }
  const stickyPinnedClass = `sticky z-[18] ${bodyBg} ${cellDivider} border-r-brand-500/45 shadow-[2px_0_6px_-3px_rgba(0,0,0,0.18),inset_-1px_0_0_0_rgba(51,136,252,0.35)]`
  const stickyPinnedHeadClass =
    `sticky z-[38] bg-brand-500/10 ${cellDivider} border-r-brand-500/45 shadow-[2px_0_6px_-3px_rgba(0,0,0,0.18),inset_-1px_0_0_0_rgba(51,136,252,0.45)]`
  const pinnedHeadText = 'text-brand-400'
  const pinnedCellText = 'text-brand-400'
  const pinnedCellSelected = 'ring-2 ring-inset ring-brand-500 bg-brand-500/10'
  const scrollCellClass = `${cellDivider} ${bodyBg}`
  const scrollHeadClass = `${cellDivider} ${headBg}`

  function isCellSelected(rowId: string, colId: string) {
    return selectedCell?.rowId === rowId && selectedCell?.colId === colId
  }

  function renderRow(row: Row, index: number) {
    return (
      <tr key={row.id} className={`${rowHover} group`}>
        <td
          className={`w-10 px-2 py-2 text-xs ${thText} text-center ${stickyIndexClass}`}
        >
          {index + 1}
        </td>
        {visibleColumns.map((col) => {
          const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id
          const isSelected = isCellSelected(row.id, col.id)
          const value = row.cells[col.id] ?? ''
          const isPinned = col.id === pinnedColumnId
          const interaction = getCellInteraction(col.type)
          const stickyClass = isPinned ? stickyPinnedClass : scrollCellClass
          const stickyStyle = isPinned ? stickyPinnedStyle : undefined
          const displayCellText = isPinned ? pinnedCellText : cellText
          const searchHighlight = view.searchQuery.trim() || undefined
          const selectedClass = isSelected
            ? isPinned
              ? pinnedCellSelected
              : 'ring-2 ring-inset ring-brand-500 bg-brand-500/10'
            : ''

          return (
            <td
              key={col.id}
              className={`px-0 py-0 min-w-[160px] ${stickyClass}`}
              style={stickyStyle}
            >
              {!canEditCell(col) ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => selectCell(row, col)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') selectCell(row, col)
                  }}
                  className={`w-full text-left px-3 py-2 min-h-[36px] cursor-default overflow-hidden ${selectedClass}`}
                  title={col.description}
                >
                  <CellValueDisplay
                    type={col.type}
                    value={value}
                    options={col.options}
                    colorCodeOptions={col.colorCodeOptions}
                    dark={dark}
                    emptyText={emptyText}
                    cellText={displayCellText}
                    highlightQuery={searchHighlight}
                  />
                </div>
              ) : isEditing ? (
                <CellValueEditor
                  type={col.type}
                  value={value}
                  options={col.options}
                  colorCodeOptions={col.colorCodeOptions}
                  alphabetizeOptions={col.alphabetizeOptions}
                  dark={dark}
                  onChange={(next) => updateCell(row.id, col.id, next)}
                  onDone={() => setEditingCell(null)}
                />
              ) : interaction === 'inline-rating' ? (
                <div
                  className={`min-h-[36px] flex items-center ${cellHover} ${selectedClass}`}
                  title={col.description}
                  onClick={() => selectCell(row, col)}
                >
                  <RatingInput
                    value={value}
                    onChange={(next) => updateCell(row.id, col.id, next)}
                    size="sm"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleCellClick(row, col, value, e)}
                  onDoubleClick={() => handleCellDoubleClick(row, col)}
                  className={`w-full text-left px-3 py-2 min-h-[36px] transition-colors overflow-hidden ${selectedClass} ${
                    interaction === 'readonly'
                      ? 'cursor-default'
                      : extractLinkHref(value)
                        ? 'cursor-text hover:text-brand-300'
                        : `${cellHover}`
                  }`}
                  title={
                    extractLinkHref(value)
                      ? `${col.description ? `${col.description} · ` : ''}Click to edit · Ctrl+click to open link`
                      : col.editPermission === 'creators_only' && !isWorkspaceAdmin
                        ? `${col.description ? `${col.description} · ` : ''}Only workspace admins can edit this field`
                        : interaction === 'readonly'
                          ? `${col.description ? `${col.description} · ` : ''}Auto-number field (read-only)`
                          : `${col.description ? `${col.description} · ` : ''}Click to edit`
                  }
                >
                  <CellValueDisplay
                    type={col.type}
                    value={value}
                    options={col.options}
                    colorCodeOptions={col.colorCodeOptions}
                    dark={dark}
                    emptyText={emptyText}
                    cellText={displayCellText}
                    highlightQuery={searchHighlight}
                  />
                </button>
              )}
            </td>
          )
        })}
        <td className={`px-2 w-10 ${scrollCellClass}`}>
          {!readOnly && (
            <button
              type="button"
              onClick={() => deleteRow(row.id)}
              className="p-1.5 text-app-faint hover:text-red-400 opacity-40 group-hover:opacity-100 transition-all rounded"
              aria-label="Delete row"
              title="Delete row"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b ${toolbar}`}>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-app-border bg-app-bg min-w-[220px] max-w-[360px] flex-1">
          <Search className="w-4 h-4 text-app-faint shrink-0" />
          <input
            ref={searchInputRef}
            type="search"
            value={view.searchQuery}
            onChange={(e) => setView((v) => ({ ...v, searchQuery: e.target.value }))}
            placeholder="Search cells..."
            className="flex-1 min-w-0 bg-transparent text-sm text-app-text outline-none placeholder:text-app-faint"
            aria-label="Search cells"
          />
          {view.searchQuery && (
            <button
              type="button"
              onClick={() => setView((v) => ({ ...v, searchQuery: '' }))}
              className="p-0.5 text-app-faint hover:text-app-muted shrink-0"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hiddenCount > 0 && schemaEditable && (
            <button
              type="button"
              onClick={() => setView((v) => ({ ...v, showHidden: !v.showHidden }))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-app-faint hover:text-app-muted hover:bg-app-surface-active"
            >
              <Eye className="w-3.5 h-3.5" />
              {view.showHidden ? 'Hide hidden fields' : `Show ${hiddenCount} hidden`}
            </button>
          )}
          {(view.sortColumnId || view.filterColumnId || view.groupColumnId || view.searchQuery) && (
            <button
              type="button"
              onClick={clearViewOverrides}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-app-faint hover:text-app-muted hover:bg-app-surface-active"
            >
              <X className="w-3.5 h-3.5" />
              Clear view
            </button>
          )}
          {schemaEditable && onManageTableTeams && (
            <button
              type="button"
              onClick={onManageTableTeams}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-app-faint hover:text-app-muted hover:bg-app-surface-active"
            >
              <Users className="w-4 h-4" />
              Team access{tableTeamCount > 0 ? ` (${tableTeamCount})` : ''}
            </button>
          )}
          {schemaEditable && (
            <button
              type="button"
              onClick={addColumn}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${addColBtn}`}
            >
              <Columns3 className="w-4 h-4" />
              Add column
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add row
            </button>
          )}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu((open) => !open)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-app-faint hover:text-app-muted hover:bg-app-surface-active"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 py-1 rounded-lg border border-app-border bg-app-surface shadow-xl min-w-[140px] z-50">
                <button
                  type="button"
                  onClick={() => {
                    downloadTableAsCsv(table)
                    setShowExportMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-app-text hover:bg-app-surface-hover"
                >
                  Export as CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadTableAsXlsx(table)
                    setShowExportMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-app-text hover:bg-app-surface-hover"
                >
                  Export as Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        ref={headerScrollRef}
        className={`shrink-0 overflow-x-auto overflow-y-hidden border-b border-app-border ${headBg} [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
      >
        <table className={tableClass}>
          <thead>
            <tr>
              <th
                className={`w-10 px-2 py-2.5 text-xs font-medium ${thText} ${stickyIndexHeadClass}`}
              >
                #
              </th>
              {visibleColumns.map((col) => {
                const isPinned = col.id === pinnedColumnId
                const headText = isPinned ? pinnedHeadText : thText
                return (
                <th
                  key={col.id}
                  className={`px-1 py-1 min-w-[160px] group/col ${
                    isPinned ? stickyPinnedHeadClass : scrollHeadClass
                  }`}
                  style={isPinned ? stickyPinnedStyle : undefined}
                >
                  {schemaEditable ? (
                    <button
                      ref={(el) => { headerRefs.current[col.id] = el }}
                      type="button"
                      onClick={() => openFieldMenu(col.id)}
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openEditField(col.id)
                      }}
                      className={`w-full flex items-center gap-1 px-2 py-1.5 rounded text-left transition-colors hover:bg-app-surface-active ${col.hidden ? 'opacity-50' : ''}`}
                      title={`${col.name} — click for menu, double-click to edit field`}
                    >
                      <span className="flex-1 min-w-0 flex items-center gap-1">
                        <span className={`text-xs font-semibold uppercase tracking-wider truncate ${headText}`}>
                          {col.name}
                        </span>
                        {col.isDisplayValue && <Star className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400" />}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditField(col.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            openEditField(col.id)
                          }
                        }}
                        className="p-0.5 rounded shrink-0 opacity-0 group-hover/col:opacity-100 transition-opacity hover:bg-app-surface-hover text-app-faint hover:text-brand-500"
                        title="Edit field"
                      >
                        <Pencil className="w-3 h-3" />
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${headText}`} />
                    </button>
                  ) : (
                    <div
                      className={`w-full flex items-center gap-1 px-2 py-1.5 ${col.hidden ? 'opacity-50' : ''}`}
                      title={col.description || col.name}
                    >
                      <span className={`text-xs font-semibold uppercase tracking-wider truncate ${headText}`}>
                        {col.name}
                      </span>
                      {col.isDisplayValue && <Star className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400" />}
                    </div>
                  )}
                </th>
                )
              })}
              <th className={`w-10 ${scrollHeadClass}`} />
            </tr>
          </thead>
        </table>
      </div>

      <div ref={gridRef} onScroll={syncHeaderScroll} className="flex-1 min-h-0 overflow-auto isolate border-t border-app-border">
        <table className={tableClass}>
          <tbody>
            {groupedRows
              ? groupedRows.flatMap(([group, rows]) => [
                <tr key={`group-${group}`} className={headBg}>
                  <td
                    colSpan={visibleColumns.length + 2}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b border-app-border ${thText}`}
                  >
                    {group} ({rows.length})
                  </td>
                </tr>,
                ...rows.map((row, index) => renderRow(row, index)),
              ])
              : processedRows.map((row, index) => renderRow(row, index))}
          </tbody>
        </table>

        {processedRows.length === 0 && (
          <div className={`flex flex-col items-center justify-center py-16 ${thText}`}>
            <p className="text-sm">
              {table.rows.length === 0
                ? 'No rows yet'
                : view.searchQuery.trim()
                  ? 'No cells match your search'
                  : 'No rows match the current filter'}
            </p>
            {table.rows.length === 0 && !readOnly ? (
              <button
                type="button"
                onClick={addRow}
                className="mt-3 text-sm font-medium text-brand-400 hover:text-brand-300"
              >
                Add your first row
              </button>
            ) : table.rows.length > 0 ? (
              <button
                type="button"
                onClick={clearViewOverrides}
                className="mt-3 text-sm font-medium text-brand-400 hover:text-brand-300"
              >
                Clear filter
              </button>
            ) : null}
          </div>
        )}
      </div>

      {schemaEditable && fieldMenu && activeColumn && (
        <FieldContextMenu
          column={activeColumn}
          anchorRect={fieldMenu.rect}
          canDelete={table.columns.length > 1}
          canEditFields={schemaEditable}
          schemaEditable={schemaEditable}
          onClose={() => setFieldMenu(null)}
          onEditField={() => setFieldModal({ columnId: activeColumn.id, mode: 'edit' })}
          onDuplicateField={() => duplicateColumn(activeColumn.id)}
          onEditDescription={() => setFieldModal({ columnId: activeColumn.id, mode: 'description' })}
          onEditPermissions={() => setFieldModal({ columnId: activeColumn.id, mode: 'permissions' })}
          onHideField={() => updateColumn(activeColumn.id, { hidden: true })}
          onSetDisplayValue={() => setDisplayValue(activeColumn.id)}
          onSortAscending={() => sortRows(activeColumn.id, 'asc')}
          onSortDescending={() => sortRows(activeColumn.id, 'desc')}
          onFilter={() => setFieldModal({ columnId: activeColumn.id, mode: 'filter' })}
          onGroup={() => setView((v) => ({
            ...v,
            groupColumnId: v.groupColumnId === activeColumn.id ? null : activeColumn.id,
          }))}
          onInsertRight={() => insertColumn(activeColumn.id, 'right')}
          onInsertLeft={() => insertColumn(activeColumn.id, 'left')}
          onDeleteField={() => deleteColumn(activeColumn.id)}
        />
      )}

      {schemaEditable && fieldModal && modalColumn && (
        <FieldModal
          key={`${fieldModal.columnId}-${fieldModal.mode}`}
          open
          mode={fieldModal.mode}
          fieldName={modalColumn.name}
          fieldType={modalColumn.type}
          description={modalColumn.description}
          editPermission={modalColumn.editPermission}
          filterValue={view.filterColumnId === modalColumn.id ? view.filterValue : ''}
          options={modalColumn.options}
          colorCodeOptions={modalColumn.colorCodeOptions}
          alphabetizeOptions={modalColumn.alphabetizeOptions}
          defaultValue={modalColumn.defaultValue}
          onClose={() => setFieldModal(null)}
          onConfirm={(value) => {
            if (fieldModal.mode === 'edit') {
              const newType = value.type ?? modalColumn.type
              const newName = value.name ?? modalColumn.name
              const updatedColumns = table.columns.map((col) => {
                if (col.id !== modalColumn.id) return col
                const next: Column = { ...col, name: newName, type: newType }
                if (isSelectFieldType(newType)) {
                  next.options = value.options?.length
                    ? value.options
                    : col.options?.length
                      ? col.options
                      : [createSelectOption('')]
                  next.colorCodeOptions = value.colorCodeOptions ?? true
                  next.alphabetizeOptions = value.alphabetizeOptions ?? false
                  next.defaultValue = value.defaultValue ?? ''
                } else {
                  delete next.options
                  delete next.colorCodeOptions
                  delete next.alphabetizeOptions
                  delete next.defaultValue
                }
                return next
              })
              let updatedRows = table.rows
              if (normalizeColumnType(newType) === 'autoNumber') {
                updatedRows = table.rows.map((row, index) => ({
                  ...row,
                  cells: {
                    ...row.cells,
                    [modalColumn.id]: row.cells[modalColumn.id] || String(index + 1),
                  },
                }))
              } else if (isSelectFieldType(newType) && value.defaultValue) {
                const defaultCell = getDefaultCellValue({ type: newType, defaultValue: value.defaultValue })
                if (defaultCell) {
                  updatedRows = table.rows.map((row) => {
                    const current = row.cells[modalColumn.id] ?? ''
                    if (current.trim()) return row
                    return {
                      ...row,
                      cells: { ...row.cells, [modalColumn.id]: defaultCell },
                    }
                  })
                }
              }
              onChange({ ...table, columns: updatedColumns, rows: updatedRows })
            }
            if (fieldModal.mode === 'description') {
              updateColumn(modalColumn.id, { description: value.description })
            }
            if (fieldModal.mode === 'permissions') {
              updateColumn(modalColumn.id, { editPermission: value.editPermission })
            }
            if (fieldModal.mode === 'filter') {
              setView((v) => ({
                ...v,
                filterColumnId: value.filterValue?.trim() ? modalColumn.id : null,
                filterValue: value.filterValue?.trim() ?? '',
              }))
            }
            setFieldModal(null)
          }}
        />
      )}
    </div>
  )
}

import { useState, useRef, useMemo } from 'react'
import { Plus, Trash2, Columns3, ChevronDown, Eye, X, Star } from 'lucide-react'
import type { Column, ColumnType, Row, Table } from '../types'
import { createId } from '../lib/id'
import EditableName from './EditableName'
import FieldContextMenu from './FieldContextMenu'
import FieldModal from './FieldModal'
import CellValueDisplay from './CellValueDisplay'
import CellValueEditor, { RatingInput, getCellInteraction } from './CellValueEditor'
import { normalizeColumnType } from '../lib/fieldTypes'
import { extractLinkHref, openLink } from '../lib/links'
import { useTheme } from '../context/ThemeContext'

interface SpreadsheetGridProps {
  table: Table
  onChange: (table: Table) => void
  dark?: boolean
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
}

export default function SpreadsheetGrid({ table, onChange, dark: darkProp, onAddRow }: SpreadsheetGridProps) {
  const { theme } = useTheme()
  const dark = darkProp ?? theme === 'dark'
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
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
  })
  const headerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const cellClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visibleColumns = useMemo(
    () => table.columns.filter((col) => view.showHidden || !col.hidden),
    [table.columns, view.showHidden],
  )

  const hiddenCount = table.columns.filter((col) => col.hidden).length

  function updateColumns(columns: Column[]) {
    onChange({ ...table, columns })
  }

  function updateColumn(colId: string, patch: Partial<Column>) {
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
      cells[col.id] = normalizeColumnType(col.type) === 'autoNumber'
        ? getNextAutoNumber(col.id)
        : ''
    })
    onChange({
      ...table,
      rows: [...table.rows, { id: createId(), cells }],
    })
  }

  function activateCellEdit(row: Row, col: Column) {
    const interaction = getCellInteraction(col.type)
    if (interaction === 'readonly' || interaction === 'inline-rating') return
    setEditingCell({ rowId: row.id, colId: col.id })
  }

  function handleCellClick(row: Row, col: Column, value: string) {
    const interaction = getCellInteraction(col.type)
    if (interaction === 'toggle') {
      const checked = value === 'true' || value === '1' || value.toLowerCase() === 'yes'
      updateCell(row.id, col.id, checked ? '' : 'true')
      return
    }
    if (interaction === 'readonly' || interaction === 'inline-rating') return

    if (extractLinkHref(value)) {
      if (cellClickTimer.current) clearTimeout(cellClickTimer.current)
      cellClickTimer.current = setTimeout(() => {
        cellClickTimer.current = null
        activateCellEdit(row, col)
      }, 250)
      return
    }

    activateCellEdit(row, col)
  }

  function handleCellDoubleClick(row: Row, col: Column, value: string) {
    if (cellClickTimer.current) {
      clearTimeout(cellClickTimer.current)
      cellClickTimer.current = null
    }
    if (openLink(value)) {
      setEditingCell(null)
      return
    }
    activateCellEdit(row, col)
  }

  function deleteRow(rowId: string) {
    onChange({ ...table, rows: table.rows.filter((r) => r.id !== rowId) })
  }

  function deleteColumn(colId: string) {
    if (table.columns.length <= 1) return
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
  }

  function createColumn(name: string, type: ColumnType = 'singleLineText'): Column {
    return { id: createId(), name, type }
  }

  function addColumn() {
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
  }

  function setDisplayValue(colId: string) {
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

  function clearViewOverrides() {
    setView({
      sortColumnId: null,
      sortDirection: 'asc',
      filterColumnId: null,
      filterValue: '',
      groupColumnId: null,
      showHidden: view.showHidden,
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
  }, [table.rows, view.filterColumnId, view.filterValue, view.sortColumnId, view.sortDirection])

  const groupedRows = useMemo(() => {
    if (!view.groupColumnId) return null
    const groups = new Map<string, Row[]>()
    processedRows.forEach((row) => {
      const key = row.cells[view.groupColumnId!] || '(Empty)'
      const list = groups.get(key) ?? []
      list.push(row)
      groups.set(key, list)
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [processedRows, view.groupColumnId])

  function openFieldMenu(colId: string) {
    const el = headerRefs.current[colId]
    if (!el) return
    setFieldMenu({ columnId: colId, rect: el.getBoundingClientRect() })
  }

  function renameTable(name: string) {
    onChange({ ...table, name })
  }

  const toolbar = dark ? 'border-app-border bg-app-surface' : 'border-gray-200 bg-white'
  const title = dark ? 'text-white' : 'text-gray-900'
  const addColBtn = dark
    ? 'text-gray-400 hover:text-brand-400 hover:bg-app-surface-active'
    : 'text-gray-600 hover:text-brand-600 hover:bg-brand-50'
  const thead = dark ? 'bg-app-surface border-app-border' : 'bg-gray-50 border-gray-200'
  const thText = dark ? 'text-gray-500' : 'text-gray-400'
  const thBorder = dark ? 'border-app-border' : 'border-gray-100'
  const rowHover = dark ? 'hover:bg-app-surface' : 'hover:bg-brand-50/20'
  const rowBorder = dark ? 'border-app-border' : 'border-gray-100'
  const cellBorder = dark ? 'border-[#222]' : 'border-gray-50'
  const cellHover = dark ? 'hover:bg-app-surface-hover' : 'hover:bg-brand-50/50'
  const cellText = dark ? 'text-gray-200' : 'text-gray-800'
  const emptyText = dark ? 'text-gray-600' : 'text-gray-300'
  const activeColumn = fieldMenu
    ? table.columns.find((col) => col.id === fieldMenu.columnId)
    : null

  const modalColumn = fieldModal
    ? table.columns.find((col) => col.id === fieldModal.columnId)
    : null

  function renderRow(row: Row, index: number) {
    return (
      <tr key={row.id} className={`border-b ${rowBorder} ${rowHover} group`}>
        <td className={`px-2 py-2 text-xs ${thText} text-center border-r ${cellBorder}`}>
          {index + 1}
        </td>
        {visibleColumns.map((col) => {
          const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id
          const value = row.cells[col.id] ?? ''

          const interaction = getCellInteraction(col.type)

          return (
            <td key={col.id} className={`px-0 py-0 border-r ${cellBorder}`}>
              {isEditing ? (
                <CellValueEditor
                  type={col.type}
                  value={value}
                  dark={dark}
                  onChange={(next) => updateCell(row.id, col.id, next)}
                  onDone={() => setEditingCell(null)}
                />
              ) : interaction === 'inline-rating' ? (
                <div
                  className={`min-h-[36px] flex items-center ${cellHover}`}
                  title={col.description}
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
                  onClick={() => handleCellClick(row, col, value)}
                  onDoubleClick={() => handleCellDoubleClick(row, col, value)}
                  className={`w-full text-left px-3 py-2 min-h-[36px] transition-colors ${
                    interaction === 'readonly'
                      ? 'cursor-default'
                      : extractLinkHref(value)
                        ? 'cursor-pointer hover:text-brand-300'
                        : cellHover
                  }`}
                  title={
                    extractLinkHref(value)
                      ? `${col.description ? `${col.description} · ` : ''}Double-click to open link`
                      : col.description
                  }
                >
                  <CellValueDisplay
                    type={col.type}
                    value={value}
                    dark={dark}
                    emptyText={emptyText}
                    cellText={cellText}
                  />
                </button>
              )}
            </td>
          )
        })}
        <td className="px-2 w-10">
          <button
            type="button"
            onClick={() => deleteRow(row.id)}
            className="p-1.5 text-gray-600 hover:text-red-400 opacity-40 group-hover:opacity-100 transition-all rounded"
            aria-label="Delete row"
            title="Delete row"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center justify-between px-4 py-3 border-b ${toolbar}`}>
        <EditableName
          value={table.name}
          onChange={renameTable}
          placeholder="Table name"
          className={`font-semibold ${title}`}
          inputClassName="text-sm font-semibold min-w-[160px]"
          dark={dark}
        />
        <div className="flex items-center gap-2">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setView((v) => ({ ...v, showHidden: !v.showHidden }))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                dark ? 'text-gray-400 hover:bg-app-surface-active' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {view.showHidden ? 'Hide hidden fields' : `Show ${hiddenCount} hidden`}
            </button>
          )}
          {(view.sortColumnId || view.filterColumnId || view.groupColumnId) && (
            <button
              type="button"
              onClick={clearViewOverrides}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                dark ? 'text-gray-400 hover:bg-app-surface-active' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <X className="w-3.5 h-3.5" />
              Clear view
            </button>
          )}
          <button
            type="button"
            onClick={addColumn}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${addColBtn}`}
          >
            <Columns3 className="w-4 h-4" />
            Add column
          </button>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add row
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead className="sticky top-0 z-10">
            <tr className={`border-b ${thead}`}>
              <th className={`w-10 px-2 py-2.5 text-xs font-medium ${thText} border-r ${thBorder}`}>#</th>
              {visibleColumns.map((col) => (
                <th key={col.id} className={`px-1 py-1 border-r ${thBorder} min-w-[160px] group/col`}>
                  <button
                    ref={(el) => { headerRefs.current[col.id] = el }}
                    type="button"
                    onClick={() => openFieldMenu(col.id)}
                    className={`w-full flex items-center gap-1 px-2 py-1.5 rounded text-left transition-colors ${
                      dark ? 'hover:bg-app-surface-active' : 'hover:bg-gray-100'
                    } ${col.hidden ? 'opacity-50' : ''}`}
                  >
                    <span className="flex-1 min-w-0 flex items-center gap-1">
                      <span className={`text-xs font-semibold uppercase tracking-wider truncate ${thText}`}>
                        {col.name}
                      </span>
                      {col.isDisplayValue && <Star className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400" />}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${thText}`} />
                  </button>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {groupedRows
              ? groupedRows.flatMap(([group, rows]) => [
                <tr key={`group-${group}`} className={dark ? 'bg-app-surface-muted' : 'bg-gray-50'}>
                  <td
                    colSpan={visibleColumns.length + 2}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${thText}`}
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
            <p className="text-sm">{table.rows.length === 0 ? 'No rows yet' : 'No rows match the current filter'}</p>
            {table.rows.length === 0 ? (
              <button
                type="button"
                onClick={addRow}
                className="mt-3 text-sm font-medium text-brand-400 hover:text-brand-300"
              >
                Add your first row
              </button>
            ) : (
              <button
                type="button"
                onClick={clearViewOverrides}
                className="mt-3 text-sm font-medium text-brand-400 hover:text-brand-300"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>

      {fieldMenu && activeColumn && (
        <FieldContextMenu
          column={activeColumn}
          anchorRect={fieldMenu.rect}
          canDelete={table.columns.length > 1}
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

      {fieldModal && modalColumn && (
        <FieldModal
          open
          mode={fieldModal.mode}
          fieldName={modalColumn.name}
          fieldType={modalColumn.type}
          description={modalColumn.description}
          editPermission={modalColumn.editPermission}
          filterValue={view.filterColumnId === modalColumn.id ? view.filterValue : ''}
          onClose={() => setFieldModal(null)}
          onConfirm={(value) => {
            if (fieldModal.mode === 'edit') {
              const newType = value.type ?? modalColumn.type
              const newName = value.name ?? modalColumn.name
              const updatedColumns = table.columns.map((col) =>
                col.id === modalColumn.id ? { ...col, name: newName, type: newType } : col,
              )
              let updatedRows = table.rows
              if (normalizeColumnType(newType) === 'autoNumber') {
                updatedRows = table.rows.map((row, index) => ({
                  ...row,
                  cells: {
                    ...row.cells,
                    [modalColumn.id]: row.cells[modalColumn.id] || String(index + 1),
                  },
                }))
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

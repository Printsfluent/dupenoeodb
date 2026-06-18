import { useMemo } from 'react'
import type { Column, Table } from '../types'
import { normalizeColumnType } from '../lib/fieldTypes'
import AttachmentThumbnails from './AttachmentThumbnails'
import CellValueDisplay from './CellValueDisplay'

interface GalleryViewProps {
  table: Table
  dark?: boolean
  readOnly?: boolean
}

function pickTitleColumn(columns: Column[]): Column | null {
  const display = columns.find((col) => col.isDisplayValue && !col.hidden)
  if (display) return display
  const text = columns.find(
    (col) => !col.hidden && normalizeColumnType(col.type) === 'singleLineText',
  )
  return text ?? columns.find((col) => !col.hidden) ?? null
}

function pickAttachmentColumns(columns: Column[]): Column[] {
  return columns.filter(
    (col) => !col.hidden && normalizeColumnType(col.type) === 'attachment',
  )
}

export default function GalleryView({ table, dark = false, readOnly: _readOnly = false }: GalleryViewProps) {
  const visibleColumns = useMemo(
    () => table.columns.filter((col) => !col.hidden),
    [table.columns],
  )
  const titleColumn = useMemo(() => pickTitleColumn(visibleColumns), [visibleColumns])
  const attachmentColumns = useMemo(
    () => pickAttachmentColumns(visibleColumns),
    [visibleColumns],
  )
  const detailColumns = useMemo(
    () =>
      visibleColumns.filter(
        (col) =>
          col.id !== titleColumn?.id && !attachmentColumns.some((item) => item.id === col.id),
      ),
    [visibleColumns, titleColumn, attachmentColumns],
  )

  if (!table.rows.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-app-faint">
        No records yet. Switch to Grid view to add rows.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="min-w-max">
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 border-b border-app-border bg-app-surface-muted text-xs font-semibold uppercase tracking-wider text-app-faint">
          <span className="w-8 shrink-0">#</span>
          {titleColumn && <span className="w-48 shrink-0 truncate">{titleColumn.name}</span>}
          {attachmentColumns.map((col) => (
            <span key={col.id} className="min-w-[320px] flex-1 truncate">
              {col.name}
            </span>
          ))}
          {detailColumns.slice(0, 2).map((col) => (
            <span key={col.id} className="w-36 shrink-0 truncate">
              {col.name}
            </span>
          ))}
        </div>

        {table.rows.map((row, index) => (
          <div
            key={row.id}
            className="flex items-start gap-3 px-4 py-3 border-b border-app-border hover:bg-app-surface-hover transition-colors"
          >
            <span className="w-8 shrink-0 pt-1 text-xs text-app-faint tabular-nums">{index + 1}</span>

            {titleColumn && (
              <div className="w-48 shrink-0 pt-0.5 text-sm font-medium text-app-text truncate">
                <CellValueDisplay
                  type={titleColumn.type}
                  value={row.cells[titleColumn.id] ?? ''}
                  options={titleColumn.options}
                  colorCodeOptions={titleColumn.colorCodeOptions}
                  dark={dark}
                  emptyText="text-app-faint"
                  cellText="text-app-text"
                />
              </div>
            )}

            {attachmentColumns.map((col) => (
              <div key={col.id} className="min-w-[320px] flex-1">
                <AttachmentThumbnails value={row.cells[col.id] ?? ''} size="md" maxVisible={16} />
              </div>
            ))}

            {attachmentColumns.length === 0 && (
              <div className="min-w-[320px] flex-1 text-xs text-app-faint pt-1">
                Add an Attachment field to show image previews here.
              </div>
            )}

            {detailColumns.slice(0, 2).map((col) => (
              <div key={col.id} className="w-36 shrink-0 text-sm text-app-muted truncate">
                <CellValueDisplay
                  type={col.type}
                  value={row.cells[col.id] ?? ''}
                  options={col.options}
                  colorCodeOptions={col.colorCodeOptions}
                  dark={dark}
                  emptyText="text-app-faint"
                  cellText="text-app-muted"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

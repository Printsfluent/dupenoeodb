import type { Column } from '../types'
import { normalizeColumnType, isSelectFieldType } from './fieldTypes'
import { findSelectOption, parseMultiSelectValue } from './selectOptions'
import { formatDateTimeDisplay, formatDateDisplay, formatTimeDisplay, parsePastedDateTime, parsePastedDate, parsePastedTime } from './dates'
import { mergeAttachmentValues, parseAttachments, resolveAttachmentBlobForClipboard, resolveAttachmentsForClipboard, serializeAttachments } from './attachments'

export interface CellCoord {
  rowId: string
  colId: string
}

export interface SelectionRange {
  anchor: CellCoord
  focus: CellCoord
}

export interface GridBounds {
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
}

export function getSelectionBounds(
  selection: SelectionRange,
  rowIds: string[],
  colIds: string[],
): GridBounds | null {
  const anchorRow = rowIds.indexOf(selection.anchor.rowId)
  const focusRow = rowIds.indexOf(selection.focus.rowId)
  const anchorCol = colIds.indexOf(selection.anchor.colId)
  const focusCol = colIds.indexOf(selection.focus.colId)
  if (anchorRow < 0 || focusRow < 0 || anchorCol < 0 || focusCol < 0) return null
  return {
    rowStart: Math.min(anchorRow, focusRow),
    rowEnd: Math.max(anchorRow, focusRow),
    colStart: Math.min(anchorCol, focusCol),
    colEnd: Math.max(anchorCol, focusCol),
  }
}

export function isCoordInBounds(
  rowId: string,
  colId: string,
  rowIds: string[],
  colIds: string[],
  bounds: GridBounds,
): boolean {
  const rowIdx = rowIds.indexOf(rowId)
  const colIdx = colIds.indexOf(colId)
  if (rowIdx < 0 || colIdx < 0) return false
  return (
    rowIdx >= bounds.rowStart &&
    rowIdx <= bounds.rowEnd &&
    colIdx >= bounds.colStart &&
    colIdx <= bounds.colEnd
  )
}

function isCheckedValue(value: string) {
  return value === 'true' || value === '1' || value.toLowerCase() === 'yes'
}

export function formatCellForClipboard(col: Column, raw: string): string {
  const normalized = normalizeColumnType(col.type)
  if (!raw.trim()) return ''

  switch (normalized) {
    case 'checkbox':
      return isCheckedValue(raw) ? 'Yes' : ''
    case 'attachment': {
      const items = parseAttachments(raw)
      return items.length > 0 ? serializeAttachments(items) : raw
    }

    case 'singleSelect': {
      const option = findSelectOption(col.options ?? [], raw)
      return option?.label ?? raw
    }
    case 'multiSelect': {
      const ids = parseMultiSelectValue(raw)
      return ids
        .map((id) => findSelectOption(col.options ?? [], id)?.label ?? id)
        .join(', ')
    }
    case 'date':
      return formatDateDisplay(raw)
    case 'time':
      return formatTimeDisplay(raw)
    case 'dateTime':
      return formatDateTimeDisplay(raw)
    default:
      return raw
  }
}

export function resolvePastedValue(col: Column, pasted: string, existing = ''): string {
  const trimmed = pasted.trim()
  const normalized = normalizeColumnType(col.type)

  if (normalized === 'attachment') {
    if (!trimmed) return existing
    return mergeAttachmentValues(existing, trimmed)
  }

  if (normalized === 'checkbox') {
    if (!trimmed) return ''
    return isCheckedValue(trimmed) ? 'true' : ''
  }

  if (normalized === 'rating') {
    if (!trimmed) return ''
    const rating = Math.min(5, Math.max(0, parseInt(trimmed, 10) || 0))
    return rating ? String(rating) : ''
  }

  if (normalized === 'autoNumber') {
    return trimmed
  }

  if (normalized === 'date' && trimmed) {
    return parsePastedDate(trimmed)
  }

  if (normalized === 'time' && trimmed) {
    return parsePastedTime(trimmed)
  }

  if (normalized === 'dateTime' && trimmed) {
    return parsePastedDateTime(trimmed)
  }

  if (!isSelectFieldType(col.type)) return trimmed

  const option = findSelectOption(col.options ?? [], trimmed)
  if (option) return option.id

  if (normalized === 'multiSelect') {
    const ids = trimmed.split(/[,|]/).map((part) => part.trim()).filter(Boolean)
    const resolved = ids.map((part) => findSelectOption(col.options ?? [], part)?.id ?? part)
    return resolved.length ? JSON.stringify(resolved) : ''
  }

  return trimmed
}

export function parseClipboardGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized.includes('\n') && !normalized.includes('\t')) {
    return [[normalized]]
  }
  return normalized.split('\n').map((line) => line.split('\t'))
}

export function serializeGridToTsv(grid: string[][]): string {
  return grid.map((row) => row.join('\t')).join('\n')
}

export function buildSelectedCellKeys(
  bounds: GridBounds | null,
  rowIds: string[],
  colIds: string[],
): Set<string> | null {
  if (!bounds) return null
  const keys = new Set<string>()
  for (let r = bounds.rowStart; r <= bounds.rowEnd; r++) {
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
      keys.add(`${rowIds[r]}:${colIds[c]}`)
    }
  }
  return keys
}

export function buildCopyText(
  bounds: GridBounds,
  rows: { id: string; cells: Record<string, string> }[],
  columns: Column[],
): string {
  const lines: string[] = []
  for (let r = bounds.rowStart; r <= bounds.rowEnd; r++) {
    const row = rows[r]
    const cells: string[] = []
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
      const col = columns[c]
      cells.push(formatCellForClipboard(col, row.cells[col.id] ?? ''))
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

export interface CopyPayload {
  text: string
  imageBlobs: Blob[]
  mediaOnly?: boolean
}

export async function buildCopyPayload(
  bounds: GridBounds,
  rows: { id: string; cells: Record<string, string> }[],
  columns: Column[],
): Promise<CopyPayload> {
  const isSingleCell =
    bounds.rowStart === bounds.rowEnd && bounds.colStart === bounds.colEnd

  if (isSingleCell) {
    const col = columns[bounds.colStart]
    const row = rows[bounds.rowStart]
    const raw = row.cells[col.id] ?? ''
    if (normalizeColumnType(col.type) === 'attachment' && raw.trim()) {
      const items = parseAttachments(raw)
      if (items.length > 0) {
        const blob = await resolveAttachmentBlobForClipboard(items[0])
        if (blob) {
          return { text: '', imageBlobs: [blob], mediaOnly: true }
        }
      }
    }
  }

  const lines: string[] = []
  const imageBlobs: Blob[] = []

  for (let r = bounds.rowStart; r <= bounds.rowEnd; r++) {
    const row = rows[r]
    const cells: string[] = []
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
      const col = columns[c]
      const raw = row.cells[col.id] ?? ''
      if (normalizeColumnType(col.type) === 'attachment' && raw.trim()) {
        const { text, imageBlobs: cellBlobs } = await resolveAttachmentsForClipboard(raw)
        cells.push(text)
        imageBlobs.push(...cellBlobs)
      } else {
        cells.push(formatCellForClipboard(col, raw))
      }
    }
    lines.push(cells.join('\t'))
  }

  return { text: lines.join('\n'), imageBlobs }
}

import * as XLSX from 'xlsx'
import type { Table } from '../types'

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function tableToRows(table: Table): string[][] {
  const headers = table.columns.map((col) => col.name)
  const data = table.rows.map((row) =>
    table.columns.map((col) => row.cells[col.id] ?? ''),
  )
  return [headers, ...data]
}

function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function safeFilename(name: string, ext: string): string {
  const base = name.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'table'
  return `${base}.${ext}`
}

export function downloadTableAsCsv(table: Table, filename?: string) {
  const rows = tableToRows(table)
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
  downloadBlob(csv, 'text/csv;charset=utf-8', safeFilename(filename ?? table.name, 'csv'))
}

export function downloadTableAsXlsx(table: Table, filename?: string) {
  const sheet = XLSX.utils.aoa_to_sheet(tableToRows(table))
  const workbook = XLSX.utils.book_new()
  const sheetName = table.name.slice(0, 31) || 'Sheet1'
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  XLSX.writeFile(workbook, safeFilename(filename ?? table.name, 'xlsx'))
}

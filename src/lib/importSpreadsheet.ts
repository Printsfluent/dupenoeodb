import * as XLSX from 'xlsx'
import type { Table } from '../types'
import { createId } from './id'

export interface ParsedSheet {
  name: string
  headers: string[]
  rows: string[][]
}

const ACCEPTED_EXTENSIONS = ['.csv', '.tsv', '.xlsx', '.xls']

export function getAcceptedFileTypes() {
  return ACCEPTED_EXTENSIONS.join(',')
}

export function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ''
      continue
    }

    current += char
  }

  result.push(current)
  return result
}

function parseDelimitedText(text: string, delimiter: string): ParsedSheet[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) throw new Error('File is empty')

  const parsed = lines.map((line) => parseCsvLine(line, delimiter))
  const headers = parsed[0].map((h, i) => h.trim() || `Column ${i + 1}`)
  const rows = parsed
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => headers.map((_, i) => (row[i] ?? '').trim()))

  return [{ name: 'Imported Data', headers, rows }]
}

function parseExcelBuffer(buffer: ArrayBuffer): ParsedSheet[] {
  const workbook = XLSX.read(buffer, { type: 'array' })

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    const rows2d = data.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : [],
    )

    if (rows2d.length === 0) {
      return { name: sheetName, headers: ['Column 1'], rows: [] }
    }

    const headerRow = rows2d[0]
    const headers = headerRow.map((h, i) => h || `Column ${i + 1}`)
    const rows = rows2d
      .slice(1)
      .filter((row) => row.some((cell) => cell.trim()))
      .map((row) => headers.map((_, i) => row[i] ?? ''))

    return { name: sheetName, headers, rows }
  }).filter((sheet) => sheet.headers.length > 0)
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet[]> {
  if (!isAcceptedFile(file)) {
    throw new Error('Unsupported file type. Use CSV, TSV, XLS, or XLSX.')
  }

  const lower = file.name.toLowerCase()

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const sheets = parseExcelBuffer(buffer)
    if (sheets.length === 0) throw new Error('No data found in spreadsheet')
    return sheets
  }

  const text = await file.text()
  const delimiter = lower.endsWith('.tsv') ? '\t' : ','
  const sheets = parseDelimitedText(text, delimiter)
  if (sheets[0].rows.length === 0 && sheets[0].headers.length === 0) {
    throw new Error('No data found in file')
  }
  return sheets
}

export function sheetToTable(sheet: ParsedSheet): Table {
  const columns = sheet.headers.map((name) => ({
    id: createId(),
    name,
    type: 'text' as const,
  }))

  const rows = sheet.rows.map((row) => ({
    id: createId(),
    cells: Object.fromEntries(columns.map((col, i) => [col.id, row[i] ?? ''])),
  }))

  return {
    id: createId(),
    name: sheet.name,
    columns,
    rows,
  }
}

export function sheetsToTables(sheets: ParsedSheet[]): Table[] {
  return sheets.map(sheetToTable)
}

export function defaultBaseNameFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Imported Base'
}

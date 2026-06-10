import { useState, useRef } from 'react'
import { X, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import {
  parseSpreadsheetFile,
  getAcceptedFileTypes,
  defaultBaseNameFromFile,
  type ParsedSheet,
} from '../lib/importSpreadsheet'

interface ImportDataModalProps {
  open: boolean
  title?: string
  mode?: 'base' | 'tables'
  onImport: (sheets: ParsedSheet[], baseName?: string) => void
  onClose: () => void
}

export default function ImportDataModal({
  open,
  title = 'Import Base',
  mode = 'base',
  onImport,
  onClose,
}: ImportDataModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [baseName, setBaseName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setSheets([])
    setBaseName('')
    setError('')
    setLoading(false)
    setDragOver(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function processFile(selected: File) {
    setError('')
    setLoading(true)
    try {
      const parsed = await parseSpreadsheetFile(selected)
      setFile(selected)
      setSheets(parsed)
      setBaseName(defaultBaseNameFromFile(selected.name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
      setFile(null)
      setSheets([])
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) processFile(selected)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const selected = e.dataTransfer.files[0]
    if (selected) processFile(selected)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || sheets.length === 0) return
    if (mode === 'base' && !baseName.trim()) return
    onImport(sheets, mode === 'base' ? baseName.trim() : undefined)
    handleClose()
  }

  if (!open) return null

  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-gray-500 hover:text-gray-300"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-[#2a2a2a] bg-[#111] hover:border-[#3a3a3a]'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={getAcceptedFileTypes()}
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-10 h-10 text-brand-400" />
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {sheets.length} table{sheets.length !== 1 ? 's' : ''} · {totalRows} row{totalRows !== 1 ? 's' : ''}
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-2 text-xs text-brand-400 hover:text-brand-300"
                >
                  Choose a different file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-300">Drop a spreadsheet here</p>
                  <p className="text-xs text-gray-500 mt-1">CSV, TSV, XLS, or XLSX</p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-[#2a2a2a] text-sm text-gray-300 hover:bg-[#333] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Reading file...' : 'Browse files'}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/40 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {sheets.length > 0 && (
            <>
              {mode === 'base' && (
                <div>
                  <label htmlFor="import-base-name" className="block text-xs font-medium text-gray-400 mb-1.5">
                    Base name
                  </label>
                  <input
                    id="import-base-name"
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                    placeholder="Name for imported base"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              <div className="rounded-lg bg-[#111] border border-[#2a2a2a] p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 mb-2">Preview</p>
                <ul className="space-y-1">
                  {sheets.map((sheet) => (
                    <li key={sheet.name} className="text-xs text-gray-400 flex justify-between">
                      <span className="truncate">{sheet.name}</span>
                      <span className="text-gray-600 shrink-0 ml-2">
                        {sheet.headers.length} cols · {sheet.rows.length} rows
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || sheets.length === 0 || (mode === 'base' && !baseName.trim()) || loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              Import
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

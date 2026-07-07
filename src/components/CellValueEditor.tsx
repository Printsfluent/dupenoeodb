import { useState, useEffect, type ReactNode } from 'react'
import { Star } from 'lucide-react'
import type { ColumnType, SelectOption } from '../types'
import { formatDateDisplay, formatTimeDisplay, mergeDateTimeToIso } from '../lib/dates'
import { normalizeColumnType } from '../lib/fieldTypes'
import SelectCellEditor from './SelectCellEditor'
import AttachmentCellEditor from './AttachmentCellEditor'

interface CellValueEditorProps {
  type: ColumnType
  value: string
  options?: SelectOption[]
  colorCodeOptions?: boolean
  alphabetizeOptions?: boolean
  onChange: (value: string) => void
  onDone?: () => void
  dark?: boolean
}

function inputClass() {
  return 'w-full px-3 py-2 border-2 outline-none text-sm bg-app-surface border-brand-500 text-app-text placeholder:text-app-faint'
}

const disableBrowserAutocomplete = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-form-type': 'other',
  name: 'sheetflow-grid-cell',
} as const

function CellInputForm({ children }: { children: ReactNode }) {
  return (
    <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="contents">
      {children}
    </form>
  )
}

function DateTimeCellEditor({
  value,
  onChange,
  onDone,
}: {
  value: string
  onChange: (value: string) => void
  onDone?: () => void
}) {
  const cls = inputClass()
  const [dateText, setDateText] = useState(() => formatDateDisplay(value))
  const [timeText, setTimeText] = useState(() => formatTimeDisplay(value))

  useEffect(() => {
    setDateText(formatDateDisplay(value))
    setTimeText(formatTimeDisplay(value))
  }, [value])

  function commit(nextDate = dateText, nextTime = timeText) {
    const iso = mergeDateTimeToIso(nextDate, nextTime, value)
    onChange(iso)
    onDone?.()
  }

  return (
    <CellInputForm>
      <div className="flex items-center gap-2 px-2 py-1.5 border-2 border-brand-500 bg-app-surface min-w-[240px]">
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={dateText}
          onChange={(e) => setDateText(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setDateText(formatDateDisplay(value))
              setTimeText(formatTimeDisplay(value))
              onDone?.()
            }
          }}
          placeholder="dd/mm/yyyy"
          aria-label="Date"
          className={`${cls} border-0 px-2 py-1 flex-1 min-w-0`}
          {...disableBrowserAutocomplete}
        />
        <span className="text-app-faint shrink-0" aria-hidden>
          |
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={timeText}
          onChange={(e) => setTimeText(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setDateText(formatDateDisplay(value))
              setTimeText(formatTimeDisplay(value))
              onDone?.()
            }
          }}
          placeholder="HH:mm"
          aria-label="Time"
          className={`${cls} border-0 px-2 py-1 w-[5.5rem] shrink-0 tabular-nums`}
          {...disableBrowserAutocomplete}
        />
      </div>
    </CellInputForm>
  )
}

function normalizeHex(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

export function RatingInput({
  value,
  onChange,
  size = 'md',
}: {
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
}) {
  const rating = Math.min(5, Math.max(0, parseInt(value, 10) || 0))
  const iconClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <span className="inline-flex gap-0.5 px-2 py-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onChange(String(i + 1 === rating ? 0 : i + 1))
          }}
          className="p-0.5 rounded hover:scale-110 transition-transform"
          aria-label={`Rate ${i + 1}`}
        >
          <Star
            className={`${iconClass} ${
              i < rating ? 'text-amber-400 fill-amber-400' : 'text-app-faint hover:text-amber-300'
            }`}
          />
        </button>
      ))}
    </span>
  )
}

export default function CellValueEditor({
  type,
  value,
  options = [],
  colorCodeOptions = true,
  alphabetizeOptions = false,
  onChange,
  onDone,
  dark,
}: CellValueEditorProps) {
  const normalized = normalizeColumnType(type)
  const cls = inputClass()
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit(next: string) {
    onChange(next)
    onDone?.()
  }

  function updateDraft(next: string) {
    setDraft(next)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && normalized !== 'longText' && normalized !== 'json' && normalized !== 'geometry') {
      e.preventDefault()
      commit(draft)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(value)
      onDone?.()
    }
  }

  switch (normalized) {
    case 'longText':
      return (
        <CellInputForm>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setDraft(value)
                onDone?.()
              }
            }}
            rows={3}
            placeholder="Enter long text..."
            className={`${cls} resize-none min-h-[72px]`}
            {...disableBrowserAutocomplete}
          />
        </CellInputForm>
      )

    case 'json':
    case 'geometry':
      return (
        <CellInputForm>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setDraft(value)
                onDone?.()
              }
            }}
            rows={3}
            placeholder={normalized === 'json' ? '{"key": "value"}' : 'POINT(lng lat)'}
            className={`${cls} resize-none font-mono text-xs min-h-[72px]`}
            {...disableBrowserAutocomplete}
          />
        </CellInputForm>
      )

    case 'number':
      return (
        <CellInputForm>
          <input
            autoFocus
            type="number"
            step="1"
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            className={cls}
            {...disableBrowserAutocomplete}
          />
        </CellInputForm>
      )

    case 'decimal':
      return (
        <CellInputForm>
          <input
            autoFocus
            type="number"
            step="any"
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={handleKeyDown}
            placeholder="0.00"
            className={cls}
            {...disableBrowserAutocomplete}
          />
        </CellInputForm>
      )

    case 'dateTime':
      return <DateTimeCellEditor value={value} onChange={commit} onDone={onDone} />

    case 'colour': {
      const hex = value.startsWith('#') ? value : value ? `#${value}` : '#3388fc'
      return (
        <CellInputForm>
          <div className="flex items-center gap-2 px-2 py-1.5 border-2 border-brand-500 bg-app-surface">
          <input
            autoFocus
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#3388fc'}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent shrink-0"
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => updateDraft(normalizeHex(e.target.value))}
            onBlur={() => commit(draft)}
            onKeyDown={handleKeyDown}
            placeholder="#3388fc"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none text-inherit"
            {...disableBrowserAutocomplete}
          />
          </div>
        </CellInputForm>
      )
    }

    case 'checkbox':
      return (
        <label className="flex items-center justify-center min-h-[36px] cursor-pointer bg-app-surface">
          <input
            autoFocus
            type="checkbox"
            checked={value === 'true' || value === '1' || value.toLowerCase() === 'yes'}
            onChange={(e) => {
              onChange(e.target.checked ? 'true' : '')
              onDone?.()
            }}
            className="w-4 h-4 rounded border-gray-600 text-brand-500 focus:ring-brand-500"
          />
        </label>
      )

    case 'rating':
      return (
        <div className="min-h-[36px] flex items-center bg-app-surface">
          <RatingInput value={value} onChange={(v) => { onChange(v); }} />
        </div>
      )

    case 'attachment':
      return (
        <AttachmentCellEditor
          value={value}
          onChange={commit}
          onDone={onDone}
        />
      )

    case 'user':
      return (
        <CellInputForm>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={handleKeyDown}
            placeholder="Name or email"
            className={cls}
            {...disableBrowserAutocomplete}
          />
        </CellInputForm>
      )

    case 'geoData':
      return (
        <CellInputForm>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={handleKeyDown}
            placeholder="Address or 37.7749, -122.4194"
            className={cls}
            {...disableBrowserAutocomplete}
          />
        </CellInputForm>
      )

    case 'autoNumber':
      return (
        <div className="px-3 py-2 text-sm tabular-nums text-app-faint bg-app-surface-muted">
          {value || '—'}
        </div>
      )

    case 'singleSelect':
    case 'multiSelect':
      return (
        <div className="relative min-h-[36px] px-2 py-1 bg-app-surface">
          <SelectCellEditor
            options={options}
            value={value}
            multiple={normalized === 'multiSelect'}
            colorCodeOptions={colorCodeOptions}
            alphabetizeOptions={alphabetizeOptions}
            dark={dark}
            onChange={(next) => commit(next)}
            onDone={() => onDone?.()}
          />
        </div>
      )

    default:
      return (
        <CellInputForm>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={handleKeyDown}
            placeholder="Enter value"
            className={cls}
            {...disableBrowserAutocomplete}
          />
        </CellInputForm>
      )
  }
}

export function getCellInteraction(type: ColumnType): 'toggle' | 'inline-rating' | 'readonly' | 'edit' | 'select' {
  const normalized = normalizeColumnType(type)
  if (normalized === 'checkbox') return 'toggle'
  if (normalized === 'rating') return 'inline-rating'
  if (normalized === 'autoNumber') return 'readonly'
  if (normalized === 'singleSelect' || normalized === 'multiSelect') return 'select'
  return 'edit'
}

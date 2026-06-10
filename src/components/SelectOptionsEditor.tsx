import { GripVertical, Plus, Trash2 } from 'lucide-react'
import type { ColumnType, SelectOption } from '../types'
import {
  createSelectOption,
  cycleSelectColor,
  sortSelectOptions,
} from '../lib/selectOptions'
import SelectOptionBadge from './SelectOptionBadge'

interface SelectOptionsEditorProps {
  fieldType: ColumnType
  options: SelectOption[]
  colorCodeOptions: boolean
  alphabetizeOptions: boolean
  defaultValue: string
  onOptionsChange: (options: SelectOption[]) => void
  onColorCodeChange: (value: boolean) => void
  onAlphabetizeChange: (value: boolean) => void
  onDefaultValueChange: (value: string) => void
}

export default function SelectOptionsEditor({
  fieldType,
  options,
  colorCodeOptions,
  alphabetizeOptions,
  defaultValue,
  onOptionsChange,
  onColorCodeChange,
  onAlphabetizeChange,
  onDefaultValueChange,
}: SelectOptionsEditorProps) {
  const isMulti = fieldType === 'multiSelect'
  const displayOptions = sortSelectOptions(options, alphabetizeOptions)

  function addOption(label?: string) {
    onOptionsChange([
      ...options,
      createSelectOption(label ?? `Option ${options.length + 1}`, options.length),
    ])
  }

  function updateOption(id: string, patch: Partial<SelectOption>) {
    onOptionsChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }

  function removeOption(id: string) {
    onOptionsChange(options.filter((o) => o.id !== id))
    if (defaultValue === id) onDefaultValueChange('')
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-app-faint leading-relaxed">
        {isMulti
          ? 'Multi select — each cell can have one or more of these choices.'
          : 'Single select — each cell can have only one of these choices.'}
        {' '}Click a color swatch to change it.
      </p>
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-xs text-app-faint cursor-pointer">
          <input
            type="checkbox"
            checked={colorCodeOptions}
            onChange={(e) => onColorCodeChange(e.target.checked)}
            className="rounded border-gray-600 text-brand-500 focus:ring-brand-500"
          />
          Color-code options
        </label>
        <label className="flex items-center gap-2 text-xs text-app-faint cursor-pointer">
          <input
            type="checkbox"
            checked={alphabetizeOptions}
            onChange={(e) => onAlphabetizeChange(e.target.checked)}
            className="rounded border-gray-600 text-brand-500 focus:ring-brand-500"
          />
          Alphabetize
        </label>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {displayOptions.length === 0 && (
          <p className="text-xs text-app-faint px-2 py-3 rounded-lg border border-dashed border-app-border text-center">
            No options yet. Add your first choice below.
          </p>
        )}
        {displayOptions.map((option) => (
          <div
            key={option.id}
            className="flex items-center gap-2 rounded-lg border border-app-border bg-app-input px-2 py-1.5"
          >
            <GripVertical className="w-3.5 h-3.5 text-app-faint shrink-0" />
            <button
              type="button"
              onClick={() => updateOption(option.id, { color: cycleSelectColor(option.color) })}
              className="shrink-0 rounded p-0.5 hover:ring-1 hover:ring-brand-500/50"
              title="Change color"
            >
              {colorCodeOptions ? (
                <SelectOptionBadge label="" color={option.color} compact />
              ) : (
                <span className="w-5 h-5 rounded bg-app-surface-active block" />
              )}
            </button>
            <input
              value={option.label}
              onChange={(e) => updateOption(option.id, { label: e.target.value })}
              placeholder="Option label"
              className="flex-1 min-w-0 bg-transparent text-sm text-app-text placeholder:text-app-faint outline-none"
            />
            <button
              type="button"
              onClick={() => removeOption(option.id)}
              className="p-1 text-app-faint hover:text-red-400 shrink-0"
              aria-label="Remove option"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => addOption()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-border text-xs text-app-muted hover:bg-app-surface-hover"
        >
          <Plus className="w-3.5 h-3.5" />
          Add option
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-app-faint mb-1.5">Default value</label>
        {isMulti ? (
          <div className="flex flex-wrap gap-1.5">
            {displayOptions.map((option) => {
              const selected = defaultValue.split('|').filter(Boolean).includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    const current = defaultValue.split('|').filter(Boolean)
                    const next = selected
                      ? current.filter((id) => id !== option.id)
                      : [...current, option.id]
                    onDefaultValueChange(next.join('|'))
                  }}
                  className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    selected
                      ? 'border-brand-500 bg-brand-500/20 text-brand-300'
                      : 'border-app-border text-app-faint hover:border-app-border-strong'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        ) : (
          <select
            value={defaultValue}
            onChange={(e) => onDefaultValueChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-app-text focus:outline-none focus:border-brand-500"
          >
            <option value="">None</option>
            {displayOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

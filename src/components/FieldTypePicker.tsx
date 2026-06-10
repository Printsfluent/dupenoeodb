import type { ColumnType } from '../types'
import { FIELD_TYPE_OPTIONS, normalizeColumnType } from '../lib/fieldTypes'

interface FieldTypePickerProps {
  value: ColumnType
  onChange: (type: ColumnType) => void
}

export default function FieldTypePicker({ value, onChange }: FieldTypePickerProps) {
  const selected = normalizeColumnType(value)

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#111] overflow-hidden">
      <div className="max-h-64 overflow-y-auto py-1">
        {FIELD_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = selected === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                isSelected
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-gray-300 hover:bg-[#1e1e1e]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-gray-200' : 'text-gray-500'}`} />
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

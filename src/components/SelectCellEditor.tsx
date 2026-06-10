import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { SelectOption } from '../types'
import { sortSelectOptions } from '../lib/selectOptions'
import SelectOptionBadge from './SelectOptionBadge'

interface SelectCellEditorProps {
  options: SelectOption[]
  value: string
  multiple?: boolean
  colorCodeOptions?: boolean
  alphabetizeOptions?: boolean
  dark?: boolean
  onChange: (value: string) => void
  onDone?: () => void
}

export default function SelectCellEditor({
  options,
  value,
  multiple = false,
  colorCodeOptions = true,
  alphabetizeOptions = false,
  dark = false,
  onChange,
  onDone,
}: SelectCellEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(true)
  const sorted = sortSelectOptions(options, alphabetizeOptions)

  const selectedIds = multiple
    ? (() => {
        try {
          const parsed = JSON.parse(value)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return value.split('|').filter(Boolean)
        }
      })()
    : value ? [value] : []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        onDone?.()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onDone])

  function toggleOption(id: string) {
    if (multiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id]
      onChange(next.length ? JSON.stringify(next) : '')
    } else {
      onChange(selectedIds.includes(id) ? '' : id)
      setOpen(false)
      onDone?.()
    }
  }

  if (!open) return null

  return (
    <div
      ref={ref}
      className={`absolute left-0 top-full z-50 mt-0.5 min-w-[180px] max-w-[260px] rounded-lg border shadow-xl py-1 ${
        dark ? 'border-app-border bg-app-surface' : 'border-gray-200 bg-white'
      }`}
    >
      {sorted.length === 0 ? (
        <p className={`px-3 py-2 text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          No options configured
        </p>
      ) : (
        sorted.map((option) => {
          const selected = selectedIds.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleOption(option.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                dark ? 'hover:bg-app-surface-hover' : 'hover:bg-gray-50'
              }`}
            >
              {colorCodeOptions ? (
                <SelectOptionBadge label={option.label} color={option.color} dark={dark} compact />
              ) : (
                <span className={dark ? 'text-gray-200' : 'text-gray-800'}>{option.label}</span>
              )}
              {selected && <Check className={`w-4 h-4 ml-auto shrink-0 ${dark ? 'text-brand-400' : 'text-brand-500'}`} />}
            </button>
          )
        })
      )}
      {multiple && (
        <div className={`px-3 py-2 border-t ${dark ? 'border-app-border' : 'border-gray-100'}`}>
          <button
            type="button"
            onClick={() => { setOpen(false); onDone?.() }}
            className="w-full py-1.5 rounded-md bg-brand-500 text-white text-xs font-medium hover:bg-brand-600"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}

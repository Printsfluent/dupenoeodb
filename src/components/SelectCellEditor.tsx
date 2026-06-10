import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import type { SelectOption } from '../types'
import { findSelectOption, parseMultiSelectValue, sortSelectOptions } from '../lib/selectOptions'
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(true)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 180,
  })

  const sorted = sortSelectOptions(options, alphabetizeOptions)

  const selectedIds = multiple
    ? parseMultiSelectValue(value)
    : value ? [value] : []

  function updateMenuPosition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(rect.width, 200),
    })
  }

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener('scroll', updateMenuPosition, true)
    window.addEventListener('resize', updateMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
      onDone?.()
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

  function renderTriggerLabel() {
    if (selectedIds.length === 0) {
      return (
        <span className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          {options.length === 0 ? 'Add options in field settings' : 'Select…'}
        </span>
      )
    }

    if (multiple) {
      return (
        <span className="inline-flex flex-wrap gap-1">
          {selectedIds.map((id) => {
            const option = findSelectOption(options, id)
            if (!option) return <span key={id} className="text-xs text-gray-400">{id}</span>
            return colorCodeOptions ? (
              <SelectOptionBadge key={id} label={option.label} color={option.color} dark={dark} compact />
            ) : (
              <span key={id} className={`text-xs ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{option.label}</span>
            )
          })}
        </span>
      )
    }

    const option = findSelectOption(options, selectedIds[0])
    if (!option) return <span className="text-sm text-gray-400">{selectedIds[0]}</span>
    return colorCodeOptions ? (
      <SelectOptionBadge label={option.label} color={option.color} dark={dark} />
    ) : (
      <span className={`text-sm ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{option.label}</span>
    )
  }

  const menu = open ? (
    <div
      ref={menuRef}
      className={`fixed z-[100] rounded-lg border shadow-xl py-1 max-h-64 overflow-y-auto ${
        dark ? 'border-app-border bg-app-surface' : 'border-gray-200 bg-white'
      }`}
      style={{
        top: menuStyle.top,
        left: menuStyle.left,
        minWidth: menuStyle.minWidth,
      }}
    >
      {sorted.length === 0 ? (
        <p className={`px-3 py-2 text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          No options yet. Edit the field to add choices.
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
              {selected && (
                <Check className={`w-4 h-4 ml-auto shrink-0 ${dark ? 'text-brand-400' : 'text-brand-500'}`} />
              )}
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
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          if (!open) updateMenuPosition()
        }}
        className={`w-full min-h-[32px] flex items-center justify-between gap-2 px-2 py-1 rounded-md text-left transition-colors ${
          dark ? 'hover:bg-app-surface-hover' : 'hover:bg-gray-50'
        }`}
      >
        <span className="flex-1 min-w-0">{renderTriggerLabel()}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 opacity-60 ${open ? 'rotate-180' : ''} transition-transform`} />
      </button>
      {menu && createPortal(menu, document.body)}
    </>
  )
}

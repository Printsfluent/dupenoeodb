import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { ColumnEditPermission, ColumnType } from '../types'
import { normalizeColumnType, getFieldTypeLabel } from '../lib/fieldTypes'
import FieldTypePicker from './FieldTypePicker'

type FieldModalMode = 'edit' | 'description' | 'permissions' | 'filter'

interface FieldModalProps {
  open: boolean
  mode: FieldModalMode
  fieldName: string
  fieldType?: ColumnType
  description?: string
  editPermission?: ColumnEditPermission
  filterValue?: string
  onConfirm: (value: {
    name?: string
    type?: ColumnType
    description?: string
    editPermission?: ColumnEditPermission
    filterValue?: string
  }) => void
  onClose: () => void
}

const PERMISSIONS: { value: ColumnEditPermission; label: string }[] = [
  { value: 'everyone', label: 'Everyone with table access' },
  { value: 'creators_only', label: 'Creators and owners only' },
]

export default function FieldModal({
  open,
  mode,
  fieldName,
  fieldType = 'singleLineText',
  description = '',
  editPermission = 'everyone',
  filterValue = '',
  onConfirm,
  onClose,
}: FieldModalProps) {
  const [name, setName] = useState(fieldName)
  const [type, setType] = useState<ColumnType>(normalizeColumnType(fieldType))
  const [desc, setDesc] = useState(description)
  const [permission, setPermission] = useState<ColumnEditPermission>(editPermission)
  const [filter, setFilter] = useState(filterValue)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setName(fieldName)
      setType(normalizeColumnType(fieldType))
      setDesc(description)
      setPermission(editPermission)
      setFilter(filterValue)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, fieldName, fieldType, description, editPermission, filterValue])

  if (!open) return null

  const titles: Record<FieldModalMode, string> = {
    edit: 'Edit field',
    description: 'Edit field description',
    permissions: 'Edit field permissions',
    filter: `Filter by ${fieldName}`,
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'edit' && !name.trim()) return
    onConfirm({
      name: mode === 'edit' ? name.trim() : undefined,
      type: mode === 'edit' ? type : undefined,
      description: mode === 'description' ? desc : undefined,
      editPermission: mode === 'permissions' ? permission : undefined,
      filterValue: mode === 'filter' ? filter : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`relative w-full rounded-xl border border-app-border bg-app-surface shadow-2xl ${
          mode === 'edit' ? 'max-w-sm' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
          <h3 className="text-sm font-semibold text-white">{titles[mode]}</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {mode === 'edit' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Field name</label>
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Field type
                  <span className="ml-2 text-gray-600 font-normal">{getFieldTypeLabel(type)}</span>
                </label>
                <FieldTypePicker value={type} onChange={setType} />
              </div>
            </>
          )}

          {mode === 'description' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                placeholder="Describe what this field is for..."
                className="w-full px-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>
          )}

          {mode === 'permissions' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Who can edit this field</label>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as ColumnEditPermission)}
                className="w-full px-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-white focus:outline-none focus:border-brand-500"
              >
                {PERMISSIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'filter' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Contains value</label>
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Leave empty to clear filter"
                className="w-full px-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-app-border text-sm text-gray-400 hover:bg-app-surface-active"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600"
            >
              {mode === 'filter' && !filter.trim() ? 'Clear filter' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  Pencil, Copy, AlignLeft, Lock, EyeOff, Star,
  ArrowUpNarrowWide, ArrowDownNarrowWide, Filter, Group,
  PanelRight, PanelLeft, Trash2, Check,
} from 'lucide-react'
import type { Column } from '../types'
import { copyToClipboard } from '../lib/copy'

interface FieldContextMenuProps {
  column: Column
  anchorRect: DOMRect
  canDelete: boolean
  onClose: () => void
  onEditField: () => void
  onDuplicateField: () => void
  onEditDescription: () => void
  onEditPermissions: () => void
  onHideField: () => void
  onSetDisplayValue: () => void
  onSortAscending: () => void
  onSortDescending: () => void
  onFilter: () => void
  onGroup: () => void
  onInsertRight: () => void
  onInsertLeft: () => void
  onDeleteField: () => void
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof Pencil
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-900/20 disabled:opacity-40'
          : disabled
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-200 hover:bg-app-surface-active'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${danger ? 'text-red-400' : disabled ? 'text-gray-600' : 'text-gray-400'}`} />
      {label}
    </button>
  )
}

function Divider() {
  return <div className="my-1 border-t border-app-border" />
}

export default function FieldContextMenu({
  column,
  anchorRect,
  canDelete,
  onClose,
  onEditField,
  onDuplicateField,
  onEditDescription,
  onEditPermissions,
  onHideField,
  onSetDisplayValue,
  onSortAscending,
  onSortDescending,
  onFilter,
  onGroup,
  onInsertRight,
  onInsertLeft,
  onDeleteField,
}: FieldContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  async function handleCopyId() {
    const ok = await copyToClipboard(column.id)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const top = anchorRect.bottom + 4
  const left = Math.min(anchorRect.left, window.innerWidth - 260)

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-60 rounded-lg border border-app-border bg-app-surface shadow-2xl py-1"
      style={{ top, left }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-app-border">
        <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase truncate">
          Field ID: {column.id}
        </span>
        <button
          type="button"
          onClick={handleCopyId}
          className="p-1 text-gray-500 hover:text-gray-300 shrink-0"
          title="Copy field ID"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      <MenuItem icon={Pencil} label="Edit field" onClick={() => { onEditField(); onClose() }} />
      <MenuItem icon={Copy} label="Duplicate field" onClick={() => { onDuplicateField(); onClose() }} />
      <MenuItem icon={AlignLeft} label="Edit field description" onClick={() => { onEditDescription(); onClose() }} />
      <MenuItem icon={Lock} label="Edit field permissions" onClick={() => { onEditPermissions(); onClose() }} />

      <Divider />

      <MenuItem icon={EyeOff} label="Hide field" onClick={() => { onHideField(); onClose() }} />
      <MenuItem
        icon={Star}
        label="Set as display value"
        onClick={() => { onSetDisplayValue(); onClose() }}
        disabled={column.isDisplayValue}
      />

      <Divider />

      <MenuItem icon={ArrowUpNarrowWide} label="Sort ascending" onClick={() => { onSortAscending(); onClose() }} />
      <MenuItem icon={ArrowDownNarrowWide} label="Sort descending" onClick={() => { onSortDescending(); onClose() }} />

      <Divider />

      <MenuItem icon={Filter} label="Filter by this field" onClick={() => { onFilter(); onClose() }} />
      <MenuItem icon={Group} label="Group by this field" onClick={() => { onGroup(); onClose() }} />

      <Divider />

      <MenuItem icon={PanelRight} label="Insert right" onClick={() => { onInsertRight(); onClose() }} />
      <MenuItem icon={PanelLeft} label="Insert left" onClick={() => { onInsertLeft(); onClose() }} />

      <Divider />

      <MenuItem
        icon={Trash2}
        label="Delete field"
        onClick={() => { onDeleteField(); onClose() }}
        danger
        disabled={!canDelete}
      />
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Pencil } from 'lucide-react'

interface EditableNameProps {
  value: string
  onChange: (name: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  showIcon?: boolean
}

export default function EditableName({
  value,
  onChange,
  placeholder = 'Untitled',
  className = '',
  inputClassName = '',
  showIcon = true,
}: EditableNameProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed) onChange(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        placeholder={placeholder}
        className={`px-2 py-0.5 rounded border outline-none focus:ring-1 focus:ring-brand-500 bg-app-input border-app-border-strong text-app-text ${inputClassName}`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`inline-flex items-center gap-1.5 group/name hover:opacity-80 transition-opacity ${className}`}
      title="Click to rename"
    >
      <span className="truncate">{value || placeholder}</span>
      {showIcon && (
        <Pencil className="w-3 h-3 shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity text-app-faint" />
      )}
    </button>
  )
}

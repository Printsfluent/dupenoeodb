import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface NameModalProps {
  open: boolean
  title: string
  label: string
  placeholder: string
  defaultValue?: string
  onConfirm: (name: string) => void
  onClose: () => void
}

export default function NameModal({
  open,
  title,
  label,
  placeholder,
  defaultValue = '',
  onConfirm,
  onClose,
}: NameModalProps) {
  const [name, setName] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(defaultValue)
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [open, defaultValue])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md rounded-xl border border-app-border bg-app-surface shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-semibold text-app-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-app-faint hover:text-app-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="name-modal-input" className="block text-xs font-medium text-app-faint mb-1.5">
              {label}
            </label>
            <input
              ref={inputRef}
              id="name-modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="app-input-field px-3 py-2.5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 app-btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

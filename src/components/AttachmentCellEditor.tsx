import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  mergeAttachmentValues,
  parseAttachments,
  readFileAsDataUrl,
  removeAttachmentAt,
  serializeAttachments,
} from '../lib/attachments'
import AttachmentThumbnails from './AttachmentThumbnails'

interface AttachmentCellEditorProps {
  value: string
  onChange: (value: string) => void
  onDone?: () => void
}

export default function AttachmentCellEditor({ value, onChange, onDone }: AttachmentCellEditorProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit(next: string) {
    onChange(next)
    onDone?.()
  }

  function applyDraft(next: string) {
    setDraft(next)
    onChange(next)
  }

  function appendAttachments(incoming: string) {
    const merged = mergeAttachmentValues(draft, incoming)
    if (merged !== draft) applyDraft(merged)
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const textItems = parseAttachments(e.clipboardData.getData('text/plain'))
    const imageFiles: File[] = []

    for (const entry of Array.from(e.clipboardData.items)) {
      if (entry.kind === 'file' && entry.type.startsWith('image/')) {
        const file = entry.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (!textItems.length && imageFiles.length === 0) return

    e.preventDefault()
    e.stopPropagation()

    if (textItems.length) {
      appendAttachments(serializeAttachments(textItems))
    }

    for (const file of imageFiles) {
      try {
        const dataUrl = await readFileAsDataUrl(file)
        if (dataUrl) appendAttachments(dataUrl)
      } catch {
        /* skip unreadable file */
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commit(draft)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(value)
      onDone?.()
    }
  }

  function handleRemove(index: number) {
    applyDraft(removeAttachmentAt(draft, index))
  }

  const attachments = parseAttachments(draft)

  return (
    <div
      className="min-h-[52px] px-2 py-2 bg-app-surface border-2 border-brand-500"
      onPaste={handlePaste}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {attachments.map((item, index) => (
            <div key={`${item.url}-${index}`} className="relative group/thumb">
              <AttachmentThumbnails value={serializeAttachments([item])} size="md" maxVisible={1} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(index)
                }}
                className="absolute -top-1 -right-1 p-0.5 rounded-full bg-app-bg border border-app-border text-app-faint hover:text-red-400 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={handleKeyDown}
        placeholder="Paste image URLs or images — one per line"
        rows={2}
        className="w-full resize-none bg-transparent text-sm text-app-text outline-none placeholder:text-app-faint"
        spellCheck={false}
      />
    </div>
  )
}

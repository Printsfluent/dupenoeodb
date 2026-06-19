import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  isImageUrl,
  mergeAttachmentValues,
  parseAttachments,
  persistAttachmentsForStorage,
  readFileAsDataUrl,
  removeAttachmentAt,
  resolveAttachmentUrl,
  resolveAttachmentsForClipboard,
  serializeAttachments,
} from '../lib/attachments'
import { copyToClipboard } from '../lib/copy'

interface AttachmentCellEditorProps {
  value: string
  onChange: (value: string) => void
  onDone?: () => void
}

function CarouselImage({ url, name }: { url: string; name?: string }) {
  const [src, setSrc] = useState(url)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    void resolveAttachmentUrl(url).then((resolved) => {
      if (!cancelled) setSrc(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  if (!isImageUrl(url) || failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-app-faint text-sm px-4 text-center">
        <span>{name ?? 'Attachment'}</span>
        <span className="text-xs break-all max-w-full opacity-70">{url}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name ?? 'Attachment'}
      className="max-h-[min(52vh,360px)] max-w-full object-contain rounded"
      onError={() => setFailed(true)}
    />
  )
}

export default function AttachmentCellEditor({ value, onChange, onDone }: AttachmentCellEditorProps) {
  const [draft, setDraft] = useState(value)
  const [viewIndex, setViewIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setDraft(value)
    if (parseAttachments(value).length > 0) {
      setExpanded(true)
    }
  }, [value])

  const attachments = parseAttachments(draft)

  useEffect(() => {
    if (viewIndex >= attachments.length) {
      setViewIndex(Math.max(0, attachments.length - 1))
    }
  }, [attachments.length, viewIndex])

  const commit = useCallback(
    async (next: string) => {
      const persisted = await persistAttachmentsForStorage(next)
      onChange(persisted)
      onDone?.()
    },
    [onChange, onDone],
  )

  function applyDraft(next: string) {
    setDraft(next)
    void persistAttachmentsForStorage(next).then(onChange)
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

    setExpanded(true)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (expanded && attachments.length > 1) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setViewIndex((index) => Math.max(0, index - 1))
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setViewIndex((index) => Math.min(attachments.length - 1, index + 1))
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void commit(draft)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(value)
      setExpanded(false)
      onDone?.()
    }
  }

  function handleCopy(e: React.ClipboardEvent) {
    if (!attachments.length) return
    e.preventDefault()
    e.stopPropagation()
    void resolveAttachmentsForClipboard(draft).then(({ text, imageBlobs }) =>
      copyToClipboard(text, imageBlobs),
    )
  }

  function handleRemove(index: number) {
    applyDraft(removeAttachmentAt(draft, index))
  }

  function showExpanded() {
    if (attachments.length > 0) setExpanded(true)
  }

  const current = attachments[viewIndex]

  return (
    <div
      className={`relative bg-app-surface border-2 border-brand-500 ${
        expanded && attachments.length > 0 ? 'min-h-[280px]' : 'min-h-[52px]'
      }`}
      onPaste={handlePaste}
      onCopy={handleCopy}
      onKeyDown={handleKeyDown}
    >
      {expanded && attachments.length > 0 && current && (
        <div className="px-3 pt-3 pb-2">
          <div className="relative flex items-center justify-center min-h-[220px] bg-app-bg/50 rounded-lg border border-app-border">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setViewIndex((index) => Math.max(0, index - 1))
              }}
              disabled={viewIndex <= 0}
              className="absolute left-2 z-10 p-2 rounded-full bg-app-bg/90 border border-app-border text-app-muted hover:text-app-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <CarouselImage url={current.url} name={current.name} />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setViewIndex((index) => Math.min(attachments.length - 1, index + 1))
              }}
              disabled={viewIndex >= attachments.length - 1}
              className="absolute right-2 z-10 p-2 rounded-full bg-app-bg/90 border border-app-border text-app-muted hover:text-app-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove(viewIndex)
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-app-bg/90 border border-app-border text-app-faint hover:text-red-400 transition-colors"
              aria-label="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {attachments.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-app-faint tabular-nums">
              <span>
                {viewIndex + 1} / {attachments.length}
              </span>
              <span className="text-app-faint/60">· use arrow keys</span>
            </div>
          )}
        </div>
      )}

      {!expanded && attachments.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            showExpanded()
          }}
          className="w-full px-3 py-2 text-left text-sm text-brand-500 hover:bg-app-surface-active transition-colors"
        >
          {attachments.length} attachment{attachments.length === 1 ? '' : 's'} — click to expand
        </button>
      )}

      <div className="px-2 pb-2">
        <textarea
          autoFocus
          value={draft}
          onFocus={showExpanded}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit(draft)}
          placeholder="Paste image URLs or images — one per line"
          rows={expanded ? 2 : 2}
          className="w-full resize-none bg-transparent text-sm text-app-text outline-none placeholder:text-app-faint"
          spellCheck={false}
        />
      </div>
    </div>
  )
}

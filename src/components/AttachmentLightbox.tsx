import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Copy, X, Maximize2 } from 'lucide-react'
import {
  isImageUrl,
  parseAttachments,
  removeAttachmentAt,
  resolveAttachmentUrl,
  resolveAttachmentsForClipboard,
  serializeAttachments,
} from '../lib/attachments'
import { copyToClipboard } from '../lib/copy'
import { useToast } from '../context/ToastContext'

function CarouselImage({ url, name, bold = false }: { url: string; name?: string; bold?: boolean }) {
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
      <div className="flex flex-col items-center justify-center gap-2 text-app-faint text-sm px-6 text-center max-w-lg">
        <span className="text-base font-medium text-app-text">{name ?? 'Attachment'}</span>
        <span className="text-xs break-all opacity-70">{url}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name ?? 'Attachment'}
      className={
        bold
          ? 'max-h-[min(82vh,720px)] max-w-[min(92vw,960px)] object-contain rounded-lg shadow-lg'
          : 'max-h-[min(52vh,360px)] max-w-full object-contain rounded'
      }
      onError={() => setFailed(true)}
    />
  )
}

interface AttachmentLightboxProps {
  value: string
  open: boolean
  onClose: () => void
  initialIndex?: number
  bold?: boolean
  editable?: boolean
  onChange?: (value: string) => void
}

export default function AttachmentLightbox({
  value,
  open,
  onClose,
  initialIndex = 0,
  bold = true,
  editable = false,
  onChange,
}: AttachmentLightboxProps) {
  const [viewIndex, setViewIndex] = useState(initialIndex)
  const { success } = useToast()
  const attachments = parseAttachments(value)

  useEffect(() => {
    if (open) setViewIndex(initialIndex)
  }, [open, initialIndex])

  useEffect(() => {
    if (viewIndex >= attachments.length) {
      setViewIndex(Math.max(0, attachments.length - 1))
    }
  }, [attachments.length, viewIndex])

  const goPrev = useCallback(() => {
    setViewIndex((index) => Math.max(0, index - 1))
  }, [])

  const goNext = useCallback(() => {
    setViewIndex((index) => Math.min(attachments.length - 1, index + 1))
  }, [attachments.length])

  const handleCopy = useCallback(() => {
    const current = attachments[viewIndex]
    if (!current) return
    const single = serializeAttachments([current])
    void resolveAttachmentsForClipboard(single).then(({ text, imageBlobs }) => {
      void copyToClipboard(text, imageBlobs).then((ok) => {
        if (ok) success('Copied attachment', 'left')
      })
    })
  }, [attachments, viewIndex, success])

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (attachments.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          goPrev()
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          goNext()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        handleCopy()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, attachments.length, onClose, goPrev, goNext, handleCopy])

  if (!open || attachments.length === 0) return null

  const current = attachments[viewIndex]

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/80 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Expanded attachments"
    >
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white/90 text-sm font-medium min-w-0">
          <Maximize2 className="w-4 h-4 shrink-0 text-brand-400" />
          <span className="truncate">
            {attachments.length > 1
              ? `Attachment ${viewIndex + 1} of ${attachments.length}`
              : 'Attachment'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/90 bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 px-4 py-6 relative">
        <button
          type="button"
          onClick={goPrev}
          disabled={viewIndex <= 0}
          className="absolute left-4 z-10 p-3 rounded-full bg-black/50 border border-white/20 text-white hover:bg-black/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {current && <CarouselImage url={current.url} name={current.name} bold={bold} />}

        <button
          type="button"
          onClick={goNext}
          disabled={viewIndex >= attachments.length - 1}
          className="absolute right-4 z-10 p-3 rounded-full bg-black/50 border border-white/20 text-white hover:bg-black/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {editable && onChange && (
          <button
            type="button"
            onClick={() => onChange(removeAttachmentAt(value, viewIndex))}
            className="absolute top-4 right-16 p-2 rounded-lg text-white/70 hover:text-red-300 hover:bg-white/10 transition-colors"
            aria-label="Remove attachment"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {attachments.length > 1 && (
        <div className="shrink-0 pb-4 flex items-center justify-center gap-2">
          {attachments.map((item, index) => (
            <button
              key={`${item.url}-${index}`}
              type="button"
              onClick={() => setViewIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === viewIndex ? 'bg-brand-400' : 'bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`View attachment ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

interface AttachmentExpandButtonProps {
  onClick: (e: React.MouseEvent) => void
  className?: string
}

export function AttachmentExpandButton({ onClick, className = '' }: AttachmentExpandButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute right-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded bg-brand-500/15 border border-brand-500/35 text-brand-500 hover:bg-brand-500/25 hover:border-brand-500/50 opacity-0 group-hover/att:opacity-100 focus:opacity-100 transition-all shadow-sm ${className}`}
      title="Expand cell"
      aria-label="Expand cell"
    >
      <Maximize2 className="w-3.5 h-3.5" />
    </button>
  )
}

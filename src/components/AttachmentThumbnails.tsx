import { useEffect, useState } from 'react'
import { FileImage, Paperclip } from 'lucide-react'
import { isAttachmentBlobRef, isImageUrl, parseAttachments, resolveAttachmentUrl } from '../lib/attachments'
import { openLink } from '../lib/links'

interface AttachmentThumbnailsProps {
  value: string
  size?: 'sm' | 'md'
  maxVisible?: number
  className?: string
}

const sizeClasses = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
} as const

function Thumbnail({
  url,
  name,
  size,
}: {
  url: string
  name?: string
  size: 'sm' | 'md'
}) {
  const [src, setSrc] = useState(url)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    if (isAttachmentBlobRef(url)) {
      void resolveAttachmentUrl(url).then((resolved) => {
        if (!cancelled) setSrc(resolved)
      })
    } else {
      setSrc(url)
    }
    return () => {
      cancelled = true
    }
  }, [url])

  const showImage = (isImageUrl(url) || isAttachmentBlobRef(url)) && !failed

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openLink(src.startsWith('data:') ? url : src)
      }}
      className={`${sizeClasses[size]} shrink-0 rounded overflow-hidden border border-app-border bg-app-surface-muted hover:ring-2 hover:ring-brand-500/50 transition-shadow`}
      title={name ?? url}
    >
      {showImage ? (
        <img
          src={src}
          alt={name ?? 'Attachment'}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-app-faint">
          {isImageUrl(url) ? <FileImage className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
        </span>
      )}
    </button>
  )
}

export default function AttachmentThumbnails({
  value,
  size = 'sm',
  maxVisible = 12,
  className = '',
}: AttachmentThumbnailsProps) {
  const items = parseAttachments(value)
  if (!items.length) return null

  const visible = items.slice(0, maxVisible)
  const overflow = items.length - visible.length

  return (
    <div className={`flex items-center gap-1 overflow-x-auto py-0.5 ${className}`}>
      {visible.map((item, index) => (
        <Thumbnail key={`${item.url}-${index}`} url={item.url} name={item.name} size={size} />
      ))}
      {overflow > 0 && (
        <span className="shrink-0 px-1.5 text-xs font-medium text-app-faint tabular-nums">
          +{overflow}
        </span>
      )}
    </div>
  )
}

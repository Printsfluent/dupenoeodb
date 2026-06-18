import { useState } from 'react'
import { FileImage, Paperclip } from 'lucide-react'
import { isImageUrl, parseAttachments } from '../lib/attachments'
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
  const [failed, setFailed] = useState(false)
  const showImage = isImageUrl(url) && !failed

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openLink(url)
      }}
      className={`${sizeClasses[size]} shrink-0 rounded overflow-hidden border border-app-border bg-app-surface-muted hover:ring-2 hover:ring-brand-500/50 transition-shadow`}
      title={name ?? url}
    >
      {showImage ? (
        <img
          src={url}
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

import { useEffect, useState } from 'react'
import { FileImage, Film, Paperclip } from 'lucide-react'
import {
  isAttachmentBlobRef,
  isImageUrl,
  isVideoUrl,
  mediaKindFromDataUrl,
  parseAttachments,
  resolveAttachmentUrl,
  type AttachmentMediaKind,
} from '../lib/attachments'
import { openLink } from '../lib/links'
import AttachmentMediaView from './AttachmentMediaView'

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
  const [openUrl, setOpenUrl] = useState(url)
  const [kind, setKind] = useState<AttachmentMediaKind>('file')

  useEffect(() => {
    let cancelled = false
    void resolveAttachmentUrl(url).then((resolved) => {
      if (cancelled) return
      setOpenUrl(resolved)
      const fromData = mediaKindFromDataUrl(resolved)
      if (fromData) setKind(fromData)
      else if (isVideoUrl(resolved)) setKind('video')
      else if (isImageUrl(resolved) || isAttachmentBlobRef(url)) setKind('image')
      else setKind('file')
    })
    return () => {
      cancelled = true
    }
  }, [url])

  const previewable = kind === 'image' || kind === 'video'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openLink(openUrl.startsWith('data:') ? openUrl : openUrl)
      }}
      className={`${sizeClasses[size]} shrink-0 rounded overflow-hidden border border-app-border bg-app-surface-muted hover:ring-2 hover:ring-brand-500/50 transition-shadow relative`}
      title={name ?? url}
    >
      {previewable ? (
        <AttachmentMediaView url={url} name={name} thumbnail />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-app-faint">
          {isVideoUrl(url) ? (
            <Film className="w-4 h-4" />
          ) : isImageUrl(url) ? (
            <FileImage className="w-4 h-4" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
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

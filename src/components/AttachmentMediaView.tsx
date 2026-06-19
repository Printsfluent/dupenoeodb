import { useEffect, useState } from 'react'
import { Film, Paperclip } from 'lucide-react'
import {
  isAttachmentBlobRef,
  isImageUrl,
  isVideoUrl,
  mediaKindFromDataUrl,
  resolveAttachmentUrl,
  type AttachmentMediaKind,
} from '../lib/attachments'

function resolveMediaKind(resolved: string, original: string): AttachmentMediaKind {
  const fromData = mediaKindFromDataUrl(resolved)
  if (fromData) return fromData
  if (isVideoUrl(resolved)) return 'video'
  if (isImageUrl(resolved) || isAttachmentBlobRef(original)) return 'image'
  return 'file'
}

interface AttachmentMediaViewProps {
  url: string
  name?: string
  bold?: boolean
  thumbnail?: boolean
  className?: string
}

export default function AttachmentMediaView({
  url,
  name,
  bold = false,
  thumbnail = false,
  className = '',
}: AttachmentMediaViewProps) {
  const [src, setSrc] = useState(url)
  const [kind, setKind] = useState<AttachmentMediaKind>('file')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    void resolveAttachmentUrl(url).then((resolved) => {
      if (cancelled) return
      setSrc(resolved)
      setKind(resolveMediaKind(resolved, url))
    })
    return () => {
      cancelled = true
    }
  }, [url])

  if (kind === 'video') {
    return (
      <div className={`relative ${className}`}>
        <video
          src={src}
          controls={!thumbnail}
          muted={thumbnail}
          playsInline
          preload={thumbnail ? 'metadata' : 'auto'}
          className={
            thumbnail
              ? 'w-full h-full object-cover'
              : bold
                ? 'max-h-[min(82vh,720px)] max-w-[min(92vw,960px)] rounded-lg shadow-lg'
                : 'max-h-[min(52vh,360px)] max-w-full object-contain rounded'
          }
          onError={() => setFailed(true)}
        />
        {thumbnail && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
            <Film className="w-4 h-4 text-white drop-shadow" />
          </span>
        )}
      </div>
    )
  }

  if (kind === 'image' && !failed) {
    return (
      <img
        src={src}
        alt={name ?? 'Attachment'}
        className={
          thumbnail
            ? `w-full h-full object-cover ${className}`
            : bold
              ? `max-h-[min(82vh,720px)] max-w-[min(92vw,960px)] object-contain rounded-lg shadow-lg ${className}`
              : `max-h-[min(52vh,360px)] max-w-full object-contain rounded ${className}`
        }
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-app-faint text-sm px-4 text-center ${
        thumbnail ? 'w-full h-full' : 'max-w-lg'
      } ${className}`}
    >
      <span className={thumbnail ? 'hidden' : ''}>{name ?? 'Attachment'}</span>
      <span className={`flex items-center justify-center ${thumbnail ? 'w-full h-full' : ''}`}>
        {isVideoUrl(url) ? (
          <Film className={thumbnail ? 'w-4 h-4' : 'w-8 h-8'} />
        ) : (
          <Paperclip className={thumbnail ? 'w-4 h-4' : 'w-8 h-8'} />
        )}
      </span>
      {!thumbnail && <span className="text-xs break-all max-w-full opacity-70">{url}</span>}
    </div>
  )
}

import { resolveAttachmentUrl, storeAttachmentBlob, isAttachmentBlobRef } from './attachmentBlobStore'
import type { Base } from '../types'

export { isAttachmentBlobRef, resolveAttachmentUrl } from './attachmentBlobStore'

export interface AttachmentItem {
  url: string
  name?: string
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

export function parseAttachments(raw: string): AttachmentItem[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') {
            const url = normalizeUrl(item)
            return url ? { url } : null
          }
          if (item && typeof item === 'object' && 'url' in item) {
            const record = item as { url?: string; name?: string }
            const url = normalizeUrl(record.url ?? '')
            return url ? { url, name: record.name } : null
          }
          return null
        })
        .filter((item): item is AttachmentItem => item !== null)
    }
  } catch {
    /* plain text / delimited URLs */
  }

  return trimmed
    .split(/\n|\|/)
    .flatMap((chunk) => chunk.split(/,(?=https?:\/\/|www\.)/i))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ url: normalizeUrl(part), name: part }))
}

export function isImageUrl(url: string): boolean {
  if (url.startsWith('data:image/')) return true
  if (url.startsWith('sf-att://')) return true
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(url)) return true
  if (/redgifs\.com|i\.redgifs\.com|imgur\.com|i\.redd\.it|cloudinary|unsplash|picsum|googleusercontent/i.test(url)) {
    return true
  }
  return false
}

export function isVideoUrl(url: string): boolean {
  if (url.startsWith('data:video/')) return true
  if (/\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv|gifv)(\?|#|$)/i.test(url)) return true
  if (/youtube\.com|youtu\.be|vimeo\.com|streamable\.com/i.test(url)) return true
  return false
}

export type AttachmentMediaKind = 'image' | 'video' | 'file'

export function mediaKindFromDataUrl(url: string): AttachmentMediaKind | null {
  if (url.startsWith('data:image/')) return 'image'
  if (url.startsWith('data:video/')) return 'video'
  return null
}

export function mediaKindFromUrl(url: string): AttachmentMediaKind {
  const fromData = mediaKindFromDataUrl(url)
  if (fromData) return fromData
  if (isVideoUrl(url)) return 'video'
  if (isImageUrl(url)) return 'image'
  return 'file'
}

export function isMediaFileType(mime: string): boolean {
  return mime.startsWith('image/') || mime.startsWith('video/')
}

export function isMediaDataUrl(value: string): boolean {
  return value.includes('data:image/') || value.includes('data:video/')
}

export function serializeAttachments(items: AttachmentItem[]): string {
  if (!items.length) return ''
  return JSON.stringify(items.map(({ url, name }) => (name ? { url, name } : { url })))
}

export function mergeAttachmentValues(existing: string, incoming: string): string {
  const merged = [...parseAttachments(existing), ...parseAttachments(incoming)]
  if (!merged.length) return ''

  const seen = new Set<string>()
  const unique = merged.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })

  return serializeAttachments(unique)
}

export function removeAttachmentAt(raw: string, index: number): string {
  const items = parseAttachments(raw)
  if (index < 0 || index >= items.length) return raw
  items.splice(index, 1)
  return serializeAttachments(items)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Move pasted data URLs into IndexedDB and return compact serialized value for cells. */
export async function persistAttachmentsForStorage(raw: string): Promise<string> {
  const items = parseAttachments(raw)
  if (!items.length) return ''
  const stored = await Promise.all(
    items.map(async (item) => ({
      ...item,
      url: item.url.startsWith('data:') ? await storeAttachmentBlob(item.url) : item.url,
    })),
  )
  return serializeAttachments(stored)
}

const MAX_INLINE_ATTACHMENT_BYTES = 750_000

async function inlineAttachmentUrl(url: string): Promise<string> {
  if (!isAttachmentBlobRef(url)) return url
  const resolved = await resolveAttachmentUrl(url)
  if (!resolved.startsWith('data:')) return url
  const blob = dataUrlToBlob(resolved)
  if (blob && blob.size > MAX_INLINE_ATTACHMENT_BYTES) return url
  return resolved
}

async function inlineAttachmentRefsInRaw(raw: string): Promise<string> {
  if (!raw.includes('sf-att://')) return raw
  const items = parseAttachments(raw)
  if (!items.length) return raw
  const inlined = await Promise.all(
    items.map(async (item) => ({
      ...item,
      url: await inlineAttachmentUrl(item.url),
    })),
  )
  return serializeAttachments(inlined)
}

/** Resolve local blob refs to inline data URLs so Firestore carries image bytes. */
export async function inlineAttachmentRefsInBase(base: Base): Promise<Base> {
  const tables = await Promise.all(
    base.tables.map(async (table) => ({
      ...table,
      rows: await Promise.all(
        table.rows.map(async (row) => {
          let changed = false
          const cells = { ...row.cells }
          for (const [colId, value] of Object.entries(cells)) {
            if (!value.includes('sf-att://')) continue
            const next = await inlineAttachmentRefsInRaw(value)
            if (next !== value) {
              cells[colId] = next
              changed = true
            }
          }
          return changed ? { ...row, cells } : row
        }),
      ),
    })),
  )
  return { ...base, tables }
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, base64] = dataUrl.split(',')
    if (!base64) return null
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

export async function resolveAttachmentBlobForClipboard(item: AttachmentItem): Promise<Blob | null> {
  const url = await resolveAttachmentUrl(item.url)
  if (url.startsWith('data:')) {
    return dataUrlToBlob(url)
  }
  if (/^https?:\/\//i.test(url) && (isImageUrl(url) || isVideoUrl(url))) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.blob()
    } catch {
      /* skip unreachable media */
    }
  }
  return null
}

export async function resolveAttachmentsForClipboard(raw: string): Promise<{
  text: string
  imageBlobs: Blob[]
}> {
  const items = parseAttachments(raw)
  if (!items.length) return { text: '', imageBlobs: [] }
  const resolved = await Promise.all(
    items.map(async (item) => ({
      ...item,
      url: await resolveAttachmentUrl(item.url),
    })),
  )
  const imageBlobs: Blob[] = []
  for (const item of resolved) {
    const blob = await resolveAttachmentBlobForClipboard(item)
    if (blob) imageBlobs.push(blob)
  }
  return { text: serializeAttachments(resolved), imageBlobs }
}

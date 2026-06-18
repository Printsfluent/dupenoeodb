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
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(url)) return true
  if (/redgifs\.com|i\.redgifs\.com|imgur\.com|i\.redd\.it|cloudinary|unsplash|picsum|googleusercontent/i.test(url)) {
    return true
  }
  return false
}

export function serializeAttachments(items: AttachmentItem[]): string {
  if (!items.length) return ''
  if (items.length === 1 && !items[0].name) return items[0].url
  return JSON.stringify(items)
}

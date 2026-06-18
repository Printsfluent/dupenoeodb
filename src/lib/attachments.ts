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
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(url)) return true
  if (/redgifs\.com|i\.redgifs\.com|imgur\.com|i\.redd\.it|cloudinary|unsplash|picsum|googleusercontent/i.test(url)) {
    return true
  }
  return false
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

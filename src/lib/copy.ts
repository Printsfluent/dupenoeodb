export type CopyOptions = {
  /** Write the media file only — omit URL/JSON from text/plain. */
  mediaOnly?: boolean
}

function clipboardMimeForBlob(blob: Blob): string {
  const type = blob.type || 'image/png'
  if (type.startsWith('image/') || type.startsWith('video/')) return type
  return 'image/png'
}

/** Copy a single image or video blob to the system clipboard. */
export async function copyMediaToClipboard(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard.write) return false

  const mime = clipboardMimeForBlob(blob)
  try {
    await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })])
    return true
  } catch {
    if (mime !== 'image/png' && blob.type.startsWith('image/')) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

export async function copyToClipboard(
  text: string,
  mediaBlobs: Blob[] = [],
  options?: CopyOptions,
) {
  const firstMedia = mediaBlobs[0]
  if (firstMedia && options?.mediaOnly) {
    return copyMediaToClipboard(firstMedia)
  }

  try {
    if (firstMedia && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      const mime = clipboardMimeForBlob(firstMedia)
      const payload: Record<string, Blob> = {
        'text/plain': new Blob([text], { type: 'text/plain' }),
        [mime]: firstMedia,
      }
      await navigator.clipboard.write([new ClipboardItem(payload)])
      return true
    }
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }
}

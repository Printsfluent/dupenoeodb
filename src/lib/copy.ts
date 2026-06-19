export async function copyToClipboard(text: string, imageBlobs: Blob[] = []) {
  try {
    if (imageBlobs.length > 0 && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      const payload: Record<string, Blob> = {
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }
      const firstImage = imageBlobs[0]
      if (firstImage) {
        payload[firstImage.type || 'image/png'] = firstImage
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

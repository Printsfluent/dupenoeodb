import { getDownloadURL, getMetadata, ref, uploadString } from 'firebase/storage'
import type { Base } from '../types'
import { parseAttachments, serializeAttachments } from './attachments'
import {
  attachmentBlobRef,
  isAttachmentBlobRef,
  resolveAttachmentUrl as resolveLocalAttachmentUrl,
} from './attachmentBlobStore'
import { getFirebaseStorage, isFirebaseConfigured } from './firebase'

export const CLOUD_ATTACHMENT_PREFIX = 'sf-cloud://'

const UPLOADED_MAP_KEY = 'sheetflow_uploaded_attachments'
const UPLOAD_CONCURRENCY = 2

const downloadUrlCache = new Map<string, string>()
let uploadedMap: Record<string, string> | null = null

export function isCloudAttachmentRef(value: string): boolean {
  return value.startsWith(CLOUD_ATTACHMENT_PREFIX)
}

export function cloudAttachmentRef(storagePath: string): string {
  return `${CLOUD_ATTACHMENT_PREFIX}${storagePath}`
}

function loadUploadedMap(): Record<string, string> {
  if (uploadedMap) return uploadedMap
  try {
    uploadedMap = JSON.parse(localStorage.getItem(UPLOADED_MAP_KEY) ?? '{}') as Record<string, string>
  } catch {
    uploadedMap = {}
  }
  return uploadedMap
}

function rememberUploaded(mapKey: string, cloudRef: string) {
  const map = loadUploadedMap()
  map[mapKey] = cloudRef
  localStorage.setItem(UPLOADED_MAP_KEY, JSON.stringify(map))
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/gif':
      return '.gif'
    case 'image/webp':
      return '.webp'
    case 'image/svg+xml':
      return '.svg'
    case 'video/mp4':
      return '.mp4'
    case 'video/webm':
      return '.webm'
    default:
      return mime.includes('/') ? `.${mime.split('/')[1]?.split('+')[0] ?? 'bin'}` : ''
  }
}

function attachmentStoragePath(workspaceId: string, baseId: string, blobId: string, mime: string) {
  return `workspaces/${workspaceId}/bases/${baseId}/attachments/${blobId}${extensionFromMime(mime)}`
}

export async function resolveCloudAttachmentUrl(url: string): Promise<string> {
  if (!isCloudAttachmentRef(url)) return url
  if (!isFirebaseConfigured()) return url

  const storagePath = url.slice(CLOUD_ATTACHMENT_PREFIX.length)
  const cached = downloadUrlCache.get(storagePath)
  if (cached) return cached

  try {
    const downloadUrl = await getDownloadURL(ref(getFirebaseStorage(), storagePath))
    downloadUrlCache.set(storagePath, downloadUrl)
    return downloadUrl
  } catch (error) {
    console.warn('Failed to resolve cloud attachment:', storagePath, error)
    return url
  }
}

async function uploadAttachmentUrl(
  url: string,
  workspaceId: string,
  baseId: string,
): Promise<string> {
  if (!isFirebaseConfigured() || !isAttachmentBlobRef(url)) return url

  const blobId = url.slice(attachmentBlobRef('').length)
  const mapKey = `${baseId}/${blobId}`
  const known = loadUploadedMap()[mapKey]
  if (known) return known

  const dataUrl = await resolveLocalAttachmentUrl(url)
  if (!dataUrl.startsWith('data:')) return url

  const mime = dataUrl.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const storagePath = attachmentStoragePath(workspaceId, baseId, blobId, mime)
  const storageRef = ref(getFirebaseStorage(), storagePath)
  const cloudRef = cloudAttachmentRef(storagePath)

  try {
    try {
      await getMetadata(storageRef)
      rememberUploaded(mapKey, cloudRef)
      return cloudRef
    } catch {
      // not uploaded yet
    }

    await uploadString(storageRef, dataUrl, 'data_url')
    rememberUploaded(mapKey, cloudRef)
    return cloudRef
  } catch (error) {
    console.warn('Attachment cloud upload failed:', storagePath, error)
    return url
  }
}

async function uploadAttachmentRefsInRaw(
  raw: string,
  workspaceId: string,
  baseId: string,
): Promise<string> {
  if (!raw.includes('sf-att://')) return raw

  const items = parseAttachments(raw)
  if (!items.length) return raw

  const uploaded = await Promise.all(
    items.map(async (item) => ({
      ...item,
      url: await uploadAttachmentUrl(item.url, workspaceId, baseId),
    })),
  )
  return serializeAttachments(uploaded)
}

export interface AttachmentUploadProgress {
  done: number
  total: number
}

/** Upload local sf-att:// blobs to Firebase Storage and return a cloud-safe base copy. */
export async function uploadAttachmentRefsInBase(
  base: Base,
  onProgress?: (progress: AttachmentUploadProgress) => void,
): Promise<Base> {
  if (!isFirebaseConfigured()) return base

  const refs: Array<{ tableIndex: number; rowIndex: number; colId: string; raw: string }> = []
  base.tables.forEach((table, tableIndex) => {
    table.rows.forEach((row, rowIndex) => {
      for (const [colId, value] of Object.entries(row.cells)) {
        if (value.includes('sf-att://')) {
          refs.push({ tableIndex, rowIndex, colId, raw: value })
        }
      }
    })
  })

  if (refs.length === 0) return base

  const total = refs.length
  let done = 0
  onProgress?.({ done, total })

  const nextBase: Base = {
    ...base,
    tables: base.tables.map((table) => ({
      ...table,
      rows: table.rows.map((row) => ({ ...row, cells: { ...row.cells } })),
    })),
  }

  let nextIndex = 0
  async function worker() {
    while (nextIndex < refs.length) {
      const current = refs[nextIndex]
      nextIndex += 1
      const uploaded = await uploadAttachmentRefsInRaw(
        current.raw,
        base.workspaceId,
        base.id,
      )
      nextBase.tables[current.tableIndex].rows[current.rowIndex].cells[current.colId] = uploaded
      done += 1
      onProgress?.({ done, total })
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, refs.length) }, () => worker()),
  )

  return nextBase
}

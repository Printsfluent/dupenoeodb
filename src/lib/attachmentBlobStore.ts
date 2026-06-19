import { createId } from './id'

const DB_NAME = 'sheetflow_attachment_blobs'
const STORE_NAME = 'blobs'
const REF_PREFIX = 'sf-att://'

const memoryCache = new Map<string, string>()
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function idbGet(id: string): Promise<string | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const request = tx.objectStore(STORE_NAME).get(id)
        request.onsuccess = () => resolve((request.result as string | undefined) ?? null)
        request.onerror = () => reject(request.error)
      }),
  )
}

function idbPut(id: string, dataUrl: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(dataUrl, id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export function isAttachmentBlobRef(value: string): boolean {
  return value.startsWith(REF_PREFIX)
}

export function attachmentBlobRef(id: string): string {
  return `${REF_PREFIX}${id}`
}

/** Store a data URL in IndexedDB and return a compact cell reference. */
export async function storeAttachmentBlob(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl
  const id = createId()
  await idbPut(id, dataUrl)
  const ref = attachmentBlobRef(id)
  memoryCache.set(ref, dataUrl)
  return ref
}

/** Resolve attachment refs to displayable URLs (uses memory cache, then IndexedDB). */
export async function resolveAttachmentUrl(url: string): Promise<string> {
  if (!isAttachmentBlobRef(url)) return url
  const cached = memoryCache.get(url)
  if (cached) return cached
  const id = url.slice(REF_PREFIX.length)
  const stored = await idbGet(id)
  if (stored) {
    memoryCache.set(url, stored)
    return stored
  }
  return url
}

export function primeAttachmentUrlCache(ref: string, dataUrl: string) {
  memoryCache.set(ref, dataUrl)
}

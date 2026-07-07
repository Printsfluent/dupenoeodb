import type { Base } from '../types'
import { countBaseRows } from './baseMerge'
import { mergeBasesRichest } from './baseMerge'
import { normalizeBase } from './tableSchema'

const DB_NAME = 'sheetflow_bases'
const STORE_NAME = 'bases'
const ARCHIVE_STORE = 'basesArchive'
const DB_VERSION = 2
const MAX_ARCHIVES_PER_BASE = 5

interface ArchiveEntry {
  savedAt: string
  base: Base
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) {
        db.createObjectStore(ARCHIVE_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function idbGet(baseId: string): Promise<Base | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const request = tx.objectStore(STORE_NAME).get(baseId)
        request.onsuccess = () => {
          const value = request.result as Base | undefined
          resolve(value ? normalizeBase(value) : null)
        }
        request.onerror = () => reject(request.error)
      }),
  )
}

function idbGetAll(): Promise<Base[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const request = tx.objectStore(STORE_NAME).getAll()
        request.onsuccess = () => {
          const values = (request.result as Base[] | undefined) ?? []
          resolve(values.filter(Boolean).map(normalizeBase))
        }
        request.onerror = () => reject(request.error)
      }),
  )
}

function idbGetAllArchiveKeys(): Promise<string[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(ARCHIVE_STORE, 'readonly')
        const request = tx.objectStore(ARCHIVE_STORE).getAllKeys()
        request.onsuccess = () => resolve((request.result as string[]) ?? [])
        request.onerror = () => reject(request.error)
      }),
  )
}

function archiveKey(baseId: string, savedAt: string) {
  return `${baseId}::${savedAt}`
}

function parseArchiveKey(key: string): { baseId: string; savedAt: string } {
  const split = key.indexOf('::')
  return {
    baseId: key.slice(0, split),
    savedAt: key.slice(split + 2),
  }
}

async function maybeArchiveBase(base: Base): Promise<void> {
  const normalized = normalizeBase(base)
  const previous = await idbGet(normalized.id)
  const previousRows = previous ? countBaseRows(previous) : 0
  const nextRows = countBaseRows(normalized)
  if (nextRows <= previousRows) return

  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ARCHIVE_STORE, 'readwrite')
    const entry: ArchiveEntry = { savedAt: new Date().toISOString(), base: normalized }
    tx.objectStore(ARCHIVE_STORE).put(entry, archiveKey(normalized.id, entry.savedAt))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  const keys = (await idbGetAllArchiveKeys()).filter((key) => parseArchiveKey(key).baseId === normalized.id)
  if (keys.length <= MAX_ARCHIVES_PER_BASE) return

  const sorted = keys
    .map((key) => ({ key, savedAt: parseArchiveKey(key).savedAt }))
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
  const remove = sorted.slice(0, sorted.length - MAX_ARCHIVES_PER_BASE)

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ARCHIVE_STORE, 'readwrite')
    const store = tx.objectStore(ARCHIVE_STORE)
    remove.forEach(({ key }) => store.delete(key))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbPut(base: Base): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(normalizeBase(base), base.id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function idbDelete(baseId: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).delete(baseId)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export async function loadAllBasesFromIdb(): Promise<Base[]> {
  try {
    return await idbGetAll()
  } catch (error) {
    console.warn('IndexedDB base load failed:', error)
    return []
  }
}

export async function loadArchivedBasesFromIdb(): Promise<Base[]> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, 'readonly')
      const request = tx.objectStore(ARCHIVE_STORE).getAll()
      request.onsuccess = () => {
        const entries = (request.result as ArchiveEntry[] | undefined) ?? []
        resolve(entries.map((entry) => normalizeBase(entry.base)))
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn('IndexedDB archive load failed:', error)
    return []
  }
}

export async function saveAllBasesToIdb(bases: Base[]): Promise<void> {
  try {
    for (const base of bases) {
      await maybeArchiveBase(base)
      await idbPut(base)
    }
  } catch (error) {
    console.warn('IndexedDB base save failed:', error)
  }
}

export async function deleteBaseFromIdb(baseId: string): Promise<void> {
  try {
    await idbDelete(baseId)
  } catch (error) {
    console.warn('IndexedDB base delete failed:', error)
  }
}

/** Prefer the fullest copy from localStorage and IndexedDB. */
export function mergeStoredBases(localStorageBases: Base[], idbBases: Base[]): Base[] {
  return mergeBasesRichest([...localStorageBases.map(normalizeBase), ...idbBases.map(normalizeBase)])
}

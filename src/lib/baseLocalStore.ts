import type { Base } from '../types'
import { mergeBasesList } from './baseMerge'
import { normalizeBase } from './tableSchema'

const DB_NAME = 'sheetflow_bases'
const STORE_NAME = 'bases'

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

export async function saveAllBasesToIdb(bases: Base[]): Promise<void> {
  try {
    await Promise.all(bases.map((base) => idbPut(base)))
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

/** Prefer the richest copy from localStorage and IndexedDB. */
export function mergeStoredBases(localStorageBases: Base[], idbBases: Base[]): Base[] {
  if (localStorageBases.length === 0) return idbBases
  if (idbBases.length === 0) return localStorageBases
  return mergeBasesList(localStorageBases.map(normalizeBase), idbBases.map(normalizeBase))
}

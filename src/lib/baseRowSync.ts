import {
  collection,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore'
import type { Base, Row } from '../types'
import { mergeTableRowSources } from './baseMerge'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'

export const TABLE_ROWS_SUBCOL = 'tableRows'
/** Stay under Firestore's 1 MiB document limit (leave headroom for metadata). */
const MAX_CHUNK_BYTES = 900_000
const BATCH_LIMIT = 450

function tableRowsCollection(baseId: string) {
  return collection(getFirestoreDb(), 'bases', baseId, TABLE_ROWS_SUBCOL)
}

function chunkRows(rows: Row[]): Row[][] {
  if (rows.length === 0) return [[]]

  const chunks: Row[][] = []
  let current: Row[] = []
  let currentBytes = 2

  for (const row of rows) {
    const rowBytes = JSON.stringify(row).length + 1
    if (current.length > 0 && currentBytes + rowBytes > MAX_CHUNK_BYTES) {
      chunks.push(current)
      current = [row]
      currentBytes = 2 + rowBytes
    } else {
      current.push(row)
      currentBytes += rowBytes
    }
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

/** Load all table row documents for a base from Firestore subcollections. */
export async function loadTableRowsFromCloud(baseId: string): Promise<Map<string, Row[]>> {
  if (!isFirebaseConfigured()) return new Map()

  try {
    const snapshot = await getDocs(tableRowsCollection(baseId))
    const chunkGroups = new Map<string, Map<number, Row[]>>()
    const fullRows = new Map<string, Row[]>()

    for (const item of snapshot.docs) {
      const data = item.data()
      const rows = (data.rows ?? []) as Row[]

      if (data.kind === 'chunk' && typeof data.tableId === 'string') {
        const tableId = data.tableId as string
        const index = typeof data.chunkIndex === 'number' ? data.chunkIndex : 0
        const group = chunkGroups.get(tableId) ?? new Map<number, Row[]>()
        group.set(index, rows)
        chunkGroups.set(tableId, group)
        continue
      }

      const tableId = (data.tableId as string | undefined) ?? item.id.replace(/__\d+$/, '')
      fullRows.set(tableId, rows)
    }

    for (const [tableId, chunks] of chunkGroups) {
      const ordered = [...chunks.entries()].sort(([a], [b]) => a - b).flatMap(([, rows]) => rows)
      fullRows.set(tableId, ordered)
    }

    return fullRows
  } catch (error) {
    console.warn('Failed to load table rows from Firestore:', error)
    return new Map()
  }
}

/** Merge embedded base rows with rows stored in Firestore subcollections. */
export async function hydrateBaseRowsFromCloud(base: Base): Promise<Base> {
  const rowsByTableId = await loadTableRowsFromCloud(base.id)
  if (rowsByTableId.size === 0) return base

  return {
    ...base,
    tables: base.tables.map((table) => {
      const cloudRows = rowsByTableId.get(table.id)
      if (!cloudRows?.length) return table
      return mergeTableRowSources({ ...table, rows: cloudRows }, table)
    }),
  }
}

async function commitBatches(
  writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }>,
  deletes: Array<ReturnType<typeof doc>>,
) {
  const db = getFirestoreDb()

  for (let index = 0; index < deletes.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db)
    deletes.slice(index, index + BATCH_LIMIT).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  for (let index = 0; index < writes.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db)
    writes.slice(index, index + BATCH_LIMIT).forEach(({ ref, data }) => batch.set(ref, data))
    await batch.commit()
  }
}

/** Persist each table's rows to Firestore subcollections (chunked when needed). */
export async function writeTableRowsToCloud(base: Base): Promise<void> {
  if (!isFirebaseConfigured()) return

  const db = getFirestoreDb()
  const updatedAt = base.updatedAt ?? new Date().toISOString()
  const targetDocIds = new Set<string>()
  const writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = []

  for (const table of base.tables) {
    const rows = table.rows ?? []
    const payload = JSON.stringify(rows)

    if (payload.length <= MAX_CHUNK_BYTES) {
      targetDocIds.add(table.id)
      writes.push({
        ref: doc(db, 'bases', base.id, TABLE_ROWS_SUBCOL, table.id),
        data: { kind: 'full', tableId: table.id, rows, updatedAt },
      })
      continue
    }

    const chunks = chunkRows(rows)
    chunks.forEach((chunk, chunkIndex) => {
      const docId = `${table.id}__${chunkIndex}`
      targetDocIds.add(docId)
      writes.push({
        ref: doc(db, 'bases', base.id, TABLE_ROWS_SUBCOL, docId),
        data: {
          kind: 'chunk',
          tableId: table.id,
          chunkIndex,
          chunkCount: chunks.length,
          rows: chunk,
          updatedAt,
        },
      })
    })
  }

  const existing = await getDocs(tableRowsCollection(base.id))
  const deletes = existing.docs
    .filter((item) => !targetDocIds.has(item.id))
    .map((item) => item.ref)

  await commitBatches(writes, deletes)
}

/** Remove all row documents for a base (called before deleting the base). */
export async function deleteTableRowsFromCloud(baseId: string): Promise<void> {
  if (!isFirebaseConfigured()) return

  try {
    const snapshot = await getDocs(tableRowsCollection(baseId))
    if (snapshot.empty) return

    const db = getFirestoreDb()
    for (let index = 0; index < snapshot.docs.length; index += BATCH_LIMIT) {
      const batch = writeBatch(db)
      snapshot.docs.slice(index, index + BATCH_LIMIT).forEach((item) => batch.delete(item.ref))
      await batch.commit()
    }
  } catch (error) {
    console.warn('Failed to delete table rows from Firestore:', error)
  }
}

export function stripRowsFromBaseMetadata(base: Base): Base {
  return {
    ...base,
    rowsStoredSeparately: true,
    tables: base.tables.map((table) => ({ ...table, rows: [] })),
  }
}

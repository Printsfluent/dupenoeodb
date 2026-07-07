import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { Base, Row, Table } from '../types'
import { mergeTableRowSources } from './baseMerge'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'

export const TABLE_ROWS_SUBCOL = 'tableRows'
/** Stay under Firestore's 1 MiB document limit (leave headroom for metadata). */
const MAX_CHUNK_BYTES = 700_000
const MAX_ROWS_PER_CHUNK = 250
const BATCH_LIMIT = 450
const WRITE_TIMEOUT_MS = 30_000
const UPLOAD_CONCURRENCY = 4

function tableRowsCollection(baseId: string) {
  return collection(getFirestoreDb(), 'bases', baseId, TABLE_ROWS_SUBCOL)
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    }),
  ])
}

function chunkRowsByBytes(rows: Row[]): Row[][] {
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

function chunkTableRows(rows: Row[]): Row[][] {
  if (rows.length === 0) return [[]]

  const slices: Row[][] = []
  for (let index = 0; index < rows.length; index += MAX_ROWS_PER_CHUNK) {
    slices.push(rows.slice(index, index + MAX_ROWS_PER_CHUNK))
  }

  return slices.flatMap((slice) => {
    const payload = JSON.stringify(slice)
    return payload.length <= MAX_CHUNK_BYTES ? [slice] : chunkRowsByBytes(slice)
  })
}

interface RowWritePlan {
  docId: string
  data: Record<string, unknown>
}

function planTableRowWrites(table: Table, updatedAt: string): RowWritePlan[] {
  const rows = table.rows ?? []
  const chunks = chunkTableRows(rows)

  if (chunks.length === 1) {
    return [
      {
        docId: table.id,
        data: { kind: 'full', tableId: table.id, rows: chunks[0], updatedAt },
      },
    ]
  }

  return chunks.map((chunk, chunkIndex) => ({
    docId: `${table.id}__${chunkIndex}`,
    data: {
      kind: 'chunk',
      tableId: table.id,
      chunkIndex,
      chunkCount: chunks.length,
      rows: chunk,
      updatedAt,
    },
  }))
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

interface RowUploadTask {
  tableName: string
  tableIndex: number
  tablesTotal: number
  chunkIndex: number
  chunkCount: number
  plan: RowWritePlan
}

async function uploadRowTasksConcurrently(
  baseId: string,
  tasks: RowUploadTask[],
  onTableProgress?: (info: {
    tableName: string
    tablesDone: number
    tablesTotal: number
    chunkIndex?: number
    chunkCount?: number
  }) => void,
) {
  if (tasks.length === 0) return

  const db = getFirestoreDb()
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex
      nextIndex += 1
      const task = tasks[taskIndex]
      onTableProgress?.({
        tableName: task.tableName,
        tablesDone: task.tableIndex,
        tablesTotal: task.tablesTotal,
        chunkIndex: task.chunkIndex,
        chunkCount: task.chunkCount,
      })

      const label = `Upload ${task.tableName}${
        task.chunkCount > 1 ? ` part ${task.chunkIndex + 1}/${task.chunkCount}` : ''
      }`
      await withTimeout(
        setDoc(doc(db, 'bases', baseId, TABLE_ROWS_SUBCOL, task.plan.docId), task.plan.data),
        WRITE_TIMEOUT_MS,
        label,
      )
    }
  }

  const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, tasks.length) }, () => worker())
  await Promise.all(workers)
}

/** Persist each table's rows in parallel chunks so large uploads finish quickly. */
export async function writeTableRowsToCloud(
  base: Base,
  onTableProgress?: (info: {
    tableName: string
    tablesDone: number
    tablesTotal: number
    chunkIndex?: number
    chunkCount?: number
  }) => void,
  options?: { skipCleanup?: boolean },
): Promise<void> {
  if (!isFirebaseConfigured()) return

  const updatedAt = base.updatedAt ?? new Date().toISOString()
  const targetDocIds = new Set<string>()
  const tablesTotal = base.tables.length
  const tasks: RowUploadTask[] = []

  for (let tableIndex = 0; tableIndex < base.tables.length; tableIndex += 1) {
    const table = base.tables[tableIndex]
    const plans = planTableRowWrites(table, updatedAt)
    plans.forEach((plan, chunkIndex) => {
      targetDocIds.add(plan.docId)
      tasks.push({
        tableName: table.name,
        tableIndex,
        tablesTotal,
        chunkIndex,
        chunkCount: plans.length,
        plan,
      })
    })
  }

  await uploadRowTasksConcurrently(base.id, tasks, onTableProgress)

  if (options?.skipCleanup) return

  const db = getFirestoreDb()
  try {
    const existing = await withTimeout(getDocs(tableRowsCollection(base.id)), WRITE_TIMEOUT_MS, 'Cleanup scan')
    const deletes = existing.docs.filter((item) => !targetDocIds.has(item.id)).map((item) => item.ref)
    for (let index = 0; index < deletes.length; index += BATCH_LIMIT) {
      const batch = writeBatch(db)
      deletes.slice(index, index + BATCH_LIMIT).forEach((ref) => batch.delete(ref))
      await withTimeout(batch.commit(), WRITE_TIMEOUT_MS, 'Cleanup delete')
    }
  } catch (error) {
    console.warn('Row cleanup skipped (upload succeeded):', error)
  }
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

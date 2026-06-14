import { collection, getDocsFromCache, query, where } from 'firebase/firestore'
import type { Base, Table } from '../types'
import { countAllBaseRows, mergeBasesList, pickRicherBase } from './baseMerge'
import { getCache, setBases } from './dataStore'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'
import { COL, persistBases } from './firestoreSync'
import { normalizeBase } from './tableSchema'
import { clearStorageBloat, pruneOversizedHistoryOnStartup, safeWriteJson } from './safeStorage'

const BASES_KEY = 'gridvault_bases'
const BASES_BACKUP_KEY = 'gridvault_bases_backup'
const BASES_HISTORY_KEY = 'gridvault_bases_history'
const MAX_HISTORY_SNAPSHOTS = 2
const MAX_HISTORY_BYTES = 250_000

interface BasesHistory {
  snapshots: Array<{ savedAt: string; bases: Base[] }>
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function looksLikeTable(value: unknown): value is Table {
  if (!value || typeof value !== 'object') return false
  const table = value as Table
  return typeof table.id === 'string' && Array.isArray(table.columns) && Array.isArray(table.rows)
}

function looksLikeBase(value: unknown): value is Base {
  if (!value || typeof value !== 'object') return false
  const base = value as Base
  return (
    typeof base.id === 'string' &&
    typeof base.workspaceId === 'string' &&
    Array.isArray(base.tables) &&
    base.tables.every(looksLikeTable)
  )
}

function extractBasesFromValue(value: unknown): Base[] {
  if (Array.isArray(value)) {
    const bases = value.filter(looksLikeBase).map(normalizeBase)
    if (bases.length > 0) return bases
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.tables) && typeof record.id === 'string' && typeof record.workspaceId === 'string') {
      const asBase = normalizeBase(record as unknown as Base)
      if (looksLikeBase(asBase)) return [asBase]
    }
    if (Array.isArray(record.bases)) {
      return extractBasesFromValue(record.bases)
    }
    if (Array.isArray(record.projects)) {
      return extractBasesFromValue(record.projects)
    }
  }

  return []
}

export function scanLocalStorageForBases(): Array<{ key: string; bases: Base[]; rowCount: number }> {
  const results: Array<{ key: string; bases: Base[]; rowCount: number }> = []

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw || raw.length < 20) continue
      const parsed = JSON.parse(raw) as unknown
      const bases = extractBasesFromValue(parsed)
      if (bases.length === 0) continue
      results.push({ key, bases, rowCount: countAllBaseRows(bases) })
    } catch {
      // ignore non-json keys
    }
  }

  return results.sort((a, b) => b.rowCount - a.rowCount)
}

function readHistoryBases(): Base[] {
  const history = readJson<BasesHistory>(BASES_HISTORY_KEY, { snapshots: [] })
  return history.snapshots.flatMap((snapshot) => snapshot.bases)
}

export function appendBasesHistory(bases: Base[]) {
  const rowCount = countAllBaseRows(bases)
  if (rowCount === 0) return

  const history = readJson<BasesHistory>(BASES_HISTORY_KEY, { snapshots: [] })
  const latest = history.snapshots[history.snapshots.length - 1]
  if (latest && countAllBaseRows(latest.bases) >= rowCount) return

  history.snapshots.push({
    savedAt: new Date().toISOString(),
    bases,
  })
  if (history.snapshots.length > MAX_HISTORY_SNAPSHOTS) {
    history.snapshots = history.snapshots.slice(-MAX_HISTORY_SNAPSHOTS)
  }

  const payload = JSON.stringify(history)
  if (payload.length > MAX_HISTORY_BYTES) {
    history.snapshots = history.snapshots.slice(-1)
  }
  safeWriteJson(BASES_HISTORY_KEY, history)
}

export function collectRecoverableBases(): Base[] {
  const candidates: Base[] = [
    ...readJson<Base[]>(BASES_KEY, []),
    ...readJson<Base[]>(BASES_BACKUP_KEY, []),
    ...readHistoryBases(),
    ...scanLocalStorageForBases().flatMap((item) => item.bases),
    ...getCache().bases,
  ]
  return mergeBasesList([], candidates)
}

export async function recoverBasesFromFirestoreCache(workspaceIds: string[]): Promise<Base[]> {
  if (!isFirebaseConfigured() || workspaceIds.length === 0) return []

  const firestore = getFirestoreDb()
  const recovered: Base[] = []

  await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      try {
        const snapshot = await getDocsFromCache(
          query(collection(firestore, COL.bases), where('workspaceId', '==', workspaceId)),
        )
        snapshot.docs.forEach((docSnap) => {
          recovered.push(normalizeBase({ id: docSnap.id, ...docSnap.data() } as Base))
        })
      } catch {
        // cache miss for this workspace
      }
    }),
  )

  return recovered
}

export interface RecoveryResult {
  restored: boolean
  previousRows: number
  recoveredRows: number
  sources: string[]
}

export async function runStartupDataRecovery(workspaceIds: string[]): Promise<RecoveryResult> {
  const current = getCache().bases
  const previousRows = countAllBaseRows(current)
  const sources: string[] = []

  let recovered = collectRecoverableBases()
  if (countAllBaseRows(recovered) > previousRows) sources.push('localStorage')

  const cached = await recoverBasesFromFirestoreCache(workspaceIds)
  const merged = mergeBasesList(recovered, cached)
  if (countAllBaseRows(merged) > countAllBaseRows(recovered)) sources.push('firestore-cache')
  recovered = merged

  const recoveredRows = countAllBaseRows(recovered)
  if (recoveredRows <= previousRows) {
    return { restored: false, previousRows, recoveredRows: previousRows, sources: [] }
  }

  const byId = new Map(current.map((base) => [base.id, normalizeBase(base)]))
  recovered.forEach((base) => {
    const existing = byId.get(base.id)
    byId.set(base.id, existing ? pickRicherBase(existing, base) : base)
  })

  const nextBases = Array.from(byId.values())
  setBases(nextBases)
  appendBasesHistory(nextBases)

  const needsCloudSync = recovered.filter((base) => {
    const before = current.find((item) => item.id === base.id)
    return !before || countAllBaseRows([base]) > countAllBaseRows([before])
  })
  if (needsCloudSync.length > 0) {
    void persistBases(needsCloudSync)
  }

  return {
    restored: true,
    previousRows,
    recoveredRows: countAllBaseRows(nextBases),
    sources,
  }
}

export function installRecoveryConsoleHelper() {
  if (typeof window === 'undefined') return
  pruneOversizedHistoryOnStartup()
  const globalWindow = window as Window & {
    sheetflowRecoverData?: () => Promise<RecoveryResult>
    sheetflowScanStorage?: () => ReturnType<typeof scanLocalStorageForBases>
    sheetflowClearStorageBloat?: () => void
  }
  globalWindow.sheetflowScanStorage = scanLocalStorageForBases
  globalWindow.sheetflowClearStorageBloat = () => {
    clearStorageBloat()
    console.info('Cleared bulky local record copies. Reload the page if storage was full.')
  }
  globalWindow.sheetflowRecoverData = async () => {
    const workspaceIds = [
      ...new Set(getCache().bases.map((base) => base.workspaceId).filter(Boolean)),
      ...new Set(getCache().workspaces.map((workspace) => workspace.id)),
    ]
    const result = await runStartupDataRecovery(workspaceIds)
    console.info('SheetFlow recovery result:', result)
    return result
  }
}

import { collection, getDocs, getDocsFromCache, query, where } from 'firebase/firestore'
import type { Base, Table } from '../types'
import { countAllBaseRows, mergeBasesList, mergeBasesRichest, mergeBaseRichest, baseHasMoreRowsThan } from './baseMerge'
import { getCache, setBases } from './dataStore'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'
import { loadAllBasesFromIdb, loadArchivedBasesFromIdb } from './baseLocalStore'
import { hydrateBaseRowsFromCloud } from './baseRowSync'
import { COL, ensureBaseInCache, persistBases } from './firestoreSync'
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

export async function collectRecoverableBasesAsync(): Promise<Base[]> {
  const idbBases = await loadAllBasesFromIdb()
  const archivedBases = await loadArchivedBasesFromIdb()
  return mergeBasesRichest([...collectRecoverableBases(), ...idbBases, ...archivedBases])
}

export interface RecoverySourceScan {
  source: string
  rowCount: number
}

export interface RecoveryScanResult {
  currentRows: number
  bestAvailableRows: number
  sources: RecoverySourceScan[]
}

function pushSourceScan(scans: RecoverySourceScan[], source: string, bases: Base[]) {
  if (bases.length === 0) return
  scans.push({ source, rowCount: countAllBaseRows(bases.map(normalizeBase)) })
}

/** List row counts found in each local/cloud copy — safe to run before restoring. */
export async function scanRecoverySources(workspaceIds: string[]): Promise<RecoveryScanResult> {
  const scans: RecoverySourceScan[] = []
  const pool: Base[] = [...getCache().bases.map(normalizeBase)]
  const currentRows = countAllBaseRows(pool)
  pushSourceScan(scans, 'App right now', pool)

  pushSourceScan(scans, 'localStorage (main)', readJson<Base[]>(BASES_KEY, []))
  pool.push(...readJson<Base[]>(BASES_KEY, []).map(normalizeBase))

  pushSourceScan(scans, 'localStorage (backup)', readJson<Base[]>(BASES_BACKUP_KEY, []))
  pool.push(...readJson<Base[]>(BASES_BACKUP_KEY, []).map(normalizeBase))

  pushSourceScan(scans, 'localStorage (history)', readHistoryBases())
  pool.push(...readHistoryBases())

  for (const item of scanLocalStorageForBases()) {
    if (item.key === BASES_KEY || item.key === BASES_BACKUP_KEY || item.key === BASES_HISTORY_KEY) continue
    scans.push({ source: `localStorage (${item.key})`, rowCount: item.rowCount })
    pool.push(...item.bases)
  }

  const idbBases = await loadAllBasesFromIdb()
  pushSourceScan(scans, 'IndexedDB (this browser)', idbBases)
  pool.push(...idbBases)

  const archivedBases = await loadArchivedBasesFromIdb()
  pushSourceScan(scans, 'IndexedDB archives', archivedBases)
  pool.push(...archivedBases)

  const cached = await recoverBasesFromFirestoreCache(workspaceIds)
  pushSourceScan(scans, 'Safari offline cache', cached)
  pool.push(...cached)

  const server = await recoverBasesFromFirestoreServer(workspaceIds)
  pushSourceScan(scans, 'Firestore server', server)
  pool.push(...server)

  const bestAvailableRows = countAllBaseRows(mergeBasesRichest(pool))

  return {
    currentRows,
    bestAvailableRows,
    sources: scans.sort((a, b) => b.rowCount - a.rowCount),
  }
}

export async function recoverBasesFromFirestoreServer(workspaceIds: string[]): Promise<Base[]> {
  if (!isFirebaseConfigured() || workspaceIds.length === 0) return []

  const firestore = getFirestoreDb()
  const recovered: Base[] = []

  await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      try {
        const snapshot = await getDocs(
          query(collection(firestore, COL.bases), where('workspaceId', '==', workspaceId)),
        )
        for (const docSnap of snapshot.docs) {
          recovered.push(
            await hydrateBaseRowsFromCloud(
              normalizeBase({ id: docSnap.id, ...docSnap.data() } as Base),
            ),
          )
        }
      } catch (error) {
        console.warn('Firestore server recovery failed for workspace', workspaceId, error)
      }
    }),
  )

  return recovered
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
        for (const docSnap of snapshot.docs) {
          recovered.push(
            await hydrateBaseRowsFromCloud(
              normalizeBase({ id: docSnap.id, ...docSnap.data() } as Base),
            ),
          )
        }
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
  rowsAdded: number
  sources: string[]
  error?: string
}

/** Scan every available copy and merge in the fullest row data for each base. */
export async function healBasesFromAllSources(workspaceIds: string[]): Promise<RecoveryResult> {
  const current = getCache().bases.map(normalizeBase)
  const previousRows = countAllBaseRows(current)
  const sources: string[] = []
  const pool: Base[] = [...current]

  const local = await collectRecoverableBasesAsync()
  if (local.length > 0) {
    pool.push(...local)
    sources.push('browser storage')
  }

  const cached = await recoverBasesFromFirestoreCache(workspaceIds)
  if (cached.length > 0) {
    pool.push(...cached)
    sources.push('firestore-cache')
  }

  const server = await recoverBasesFromFirestoreServer(workspaceIds)
  if (server.length > 0) {
    pool.push(...server)
    sources.push('firestore-server')
  }

  const richest = mergeBasesRichest(pool)
  const byId = new Map(current.map((base) => [base.id, base]))
  const changed: Base[] = []

  for (const base of richest) {
    const existing = byId.get(base.id)
    if (!existing) {
      byId.set(base.id, base)
      changed.push(base)
      continue
    }
    const merged = mergeBaseRichest(existing, base)
    if (baseHasMoreRowsThan(merged, existing)) {
      byId.set(base.id, merged)
      changed.push(merged)
    }
  }

  const nextBases = Array.from(byId.values())
  const recoveredRows = countAllBaseRows(nextBases)
  const rowsAdded = recoveredRows - previousRows

  if (rowsAdded <= 0) {
    return { restored: false, previousRows, recoveredRows: previousRows, rowsAdded: 0, sources: [] }
  }

  setBases(nextBases)
  appendBasesHistory(nextBases)

  if (isFirebaseConfigured() && changed.length > 0) {
    try {
      await persistBases(changed)
    } catch (error) {
      console.warn('Failed to push recovered bases to Firestore:', error)
    }
  }

  return {
    restored: true,
    previousRows,
    recoveredRows,
    rowsAdded,
    sources: [...new Set(sources)],
  }
}

/** True when older browser/offline copies have more row data than the current cache. */
export async function canOfferDataRecovery(workspaceIds: string[]): Promise<boolean> {
  const current = getCache().bases
  let candidates = await collectRecoverableBasesAsync()

  if (candidates.length === 0 && workspaceIds.length > 0) {
    candidates = await recoverBasesFromFirestoreCache(workspaceIds)
  }
  if (candidates.length === 0 && workspaceIds.length > 0) {
    candidates = await recoverBasesFromFirestoreServer(workspaceIds)
  }
  if (candidates.length === 0) return false

  if (current.length === 0) {
    return countAllBaseRows(candidates) > 0
  }

  const richest = mergeBasesRichest([...current.map(normalizeBase), ...candidates.map(normalizeBase)])
  return countAllBaseRows(richest) > countAllBaseRows(current)
}

/** Merge richer copies from every source into the current cache. */
export async function runManualDataRecovery(workspaceIds: string[]): Promise<RecoveryResult> {
  return healBasesFromAllSources(workspaceIds)
}

export async function runStartupDataRecovery(workspaceIds: string[]): Promise<RecoveryResult> {
  const current = getCache().bases

  if (current.length === 0) {
    const sources: string[] = []
    let recovered = await collectRecoverableBasesAsync()
    if (recovered.length > 0) sources.push('browser storage')

    const cached = await recoverBasesFromFirestoreCache(workspaceIds)
    recovered = mergeBasesList(recovered, cached)
    if (cached.length > 0) sources.push('firestore-cache')

    const server = await recoverBasesFromFirestoreServer(workspaceIds)
    recovered = mergeBasesList(recovered, server)
    if (server.length > 0) sources.push('firestore-server')

    if (recovered.length === 0) {
      return { restored: false, previousRows: 0, recoveredRows: 0, rowsAdded: 0, sources: [] }
    }

    setBases(recovered)
    appendBasesHistory(recovered)

    await Promise.all(recovered.map((base) => ensureBaseInCache(base.id)))

    const recoveredRows = countAllBaseRows(recovered)
    return {
      restored: true,
      previousRows: 0,
      recoveredRows,
      rowsAdded: recoveredRows,
      sources,
    }
  }

  // Cache exists — still scan all sources in case a richer copy was missed on hydrate.
  return healBasesFromAllSources(workspaceIds)
}

async function recoveryWorkspaceIds(): Promise<string[]> {
  const fromCache = [
    ...getCache().bases.map((base) => base.workspaceId),
    ...getCache().workspaces.map((workspace) => workspace.id),
  ]
  const fromStorage = (await collectRecoverableBasesAsync()).map((base) => base.workspaceId)
  return [...new Set([...fromCache, ...fromStorage].filter(Boolean))]
}

export function installRecoveryConsoleHelper() {
  if (typeof window === 'undefined') return
  pruneOversizedHistoryOnStartup()
  const globalWindow = window as Window & {
    sheetflowRecoverData?: () => Promise<RecoveryResult>
    sheetflowScanStorage?: () => ReturnType<typeof scanLocalStorageForBases>
    sheetflowScanAllSources?: () => Promise<RecoveryScanResult>
    sheetflowClearStorageBloat?: () => void
  }
  globalWindow.sheetflowScanStorage = scanLocalStorageForBases
  globalWindow.sheetflowScanAllSources = async () => {
    const workspaceIds = await recoveryWorkspaceIds()
    const result = await scanRecoverySources(workspaceIds)
    console.log('=== SheetFlow storage scan ===')
    console.log(`Loaded now: ${result.currentRows} records`)
    console.log(`Best in this browser: ${result.bestAvailableRows} records`)
    console.table(result.sources)
    return result
  }
  globalWindow.sheetflowClearStorageBloat = () => {
    clearStorageBloat()
    console.info('Cleared bulky local record copies. Reload the page if storage was full.')
  }
  globalWindow.sheetflowRecoverData = async () => {
    try {
      const workspaceIds = await recoveryWorkspaceIds()
      const result = await runManualDataRecovery(workspaceIds)
      console.log('=== SheetFlow recovery ===')
      console.log(
        result.restored
          ? `Restored ${result.rowsAdded} missing records (${result.recoveredRows} total)`
          : `No richer copy found (${result.recoveredRows} records in this browser)`,
      )
      console.log(result)
      return result
    } catch (error) {
      const failed = {
        restored: false,
        previousRows: countAllBaseRows(getCache().bases),
        recoveredRows: countAllBaseRows(getCache().bases),
        rowsAdded: 0,
        sources: [],
        error: error instanceof Error ? error.message : String(error),
      }
      console.error('SheetFlow recovery failed:', error)
      return failed
    }
  }
}

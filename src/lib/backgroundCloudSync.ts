import { countAllBaseRows } from './baseMerge'
import { getCache, subscribeDataCache } from './dataStore'
import { isFirebaseConfigured } from './firebase'
import { flushCacheToLocalStorageAsync } from './localPersistence'
import { isCloudSyncInProgress, syncAllCachedBasesToCloud } from './firestoreSync'

export type BackgroundSyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error'

const DEBOUNCE_MS = 45_000
const MIN_INTERVAL_MS = 90_000
const INITIAL_DELAY_MS = 20_000
const INTERVAL_MS = 3 * 60_000

let status: BackgroundSyncStatus = 'idle'
let statusMessage = ''
let lastSyncedAt: number | null = null
let lastError: string | null = null
let debounceTimer: number | null = null
let lastAttemptAt = 0
let lastRowCount = 0

const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

function setBackgroundStatus(next: BackgroundSyncStatus, message = '') {
  status = next
  statusMessage = message
  notifyListeners()
}

export function getBackgroundSyncState() {
  return { status, statusMessage, lastSyncedAt, lastError }
}

export function subscribeBackgroundSync(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function scheduleBackgroundCloudSync() {
  if (!isFirebaseConfigured() || !navigator.onLine) return
  setBackgroundStatus('pending', 'Saved locally — cloud sync queued')
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    void runBackgroundCloudSync()
  }, DEBOUNCE_MS)
}

export async function runBackgroundCloudSync(force = false): Promise<void> {
  if (!isFirebaseConfigured() || !navigator.onLine) return
  if (isCloudSyncInProgress()) return

  const localRows = countAllBaseRows(getCache().bases)
  if (localRows === 0) return

  const now = Date.now()
  if (!force && now - lastAttemptAt < MIN_INTERVAL_MS) return

  lastAttemptAt = now
  setBackgroundStatus('syncing', 'Syncing records and attachments to cloud…')

  try {
    await flushCacheToLocalStorageAsync()
    const result = await syncAllCachedBasesToCloud((progress) => {
      if (progress.phase === 'attachments') {
        const done = progress.attachmentsDone ?? 0
        const total = progress.attachmentsTotal ?? 0
        setBackgroundStatus(
          'syncing',
          total > 0 ? `Uploading attachments (${done}/${total})…` : 'Uploading attachments…',
        )
        return
      }
      if (progress.phase === 'rows') {
        const part =
          progress.chunkCount && progress.chunkCount > 1
            ? ` part ${(progress.chunkIndex ?? 0) + 1}/${progress.chunkCount}`
            : ''
        setBackgroundStatus('syncing', `Syncing rows: ${progress.tableName ?? 'table'}${part}…`)
        return
      }
      if (progress.phase === 'metadata') {
        setBackgroundStatus('syncing', `Syncing ${progress.baseName ?? 'database'}…`)
      }
    })

    lastSyncedAt = Date.now()
    lastError = null
    setBackgroundStatus('synced', `Cloud backup up to date (${result.rows} records)`)
    window.setTimeout(() => {
      if (status === 'synced') setBackgroundStatus('idle')
    }, 6000)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cloud sync failed'
    lastError = message
    setBackgroundStatus('error', message)
  }
}

/** Background row + attachment sync after edits, on reconnect, and on a timer. */
export function installBackgroundCloudSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  lastRowCount = countAllBaseRows(getCache().bases)

  const unsubCache = subscribeDataCache(() => {
    const rows = countAllBaseRows(getCache().bases)
    if (rows !== lastRowCount) {
      lastRowCount = rows
      scheduleBackgroundCloudSync()
    }
  })

  const initialTimer = window.setTimeout(() => {
    void runBackgroundCloudSync(true)
  }, INITIAL_DELAY_MS)

  const intervalId = window.setInterval(() => {
    void runBackgroundCloudSync()
  }, INTERVAL_MS)

  const onOnline = () => {
    void runBackgroundCloudSync(true)
  }
  window.addEventListener('online', onOnline)

  return () => {
    unsubCache()
    window.clearTimeout(initialTimer)
    window.clearInterval(intervalId)
    window.removeEventListener('online', onOnline)
    if (debounceTimer) window.clearTimeout(debounceTimer)
  }
}

import { countAllBaseRows } from './baseMerge'
import { getCache } from './dataStore'
import { scanRecoverySources } from './dataRecovery'
import { isFirebaseConfigured } from './firebase'
import { flushCacheToLocalStorageAsync } from './localPersistence'
import { syncAllCachedBasesToCloud } from './firestoreSync'

const BACKGROUND_SYNC_MS = 2 * 60 * 1000
let lastBackgroundSyncAt = 0

/** Save IndexedDB + upload to Firestore when this browser has more rows than the cloud. */
export async function pushLocalToCloudIfAhead(
  workspaceIds: string[],
): Promise<{ pushed: boolean; localRows: number; cloudRows: number }> {
  if (!isFirebaseConfigured() || workspaceIds.length === 0) {
    return { pushed: false, localRows: countAllBaseRows(getCache().bases), cloudRows: 0 }
  }

  await flushCacheToLocalStorageAsync()
  const scan = await scanRecoverySources(workspaceIds)
  if (scan.currentRows <= scan.cloudRows) {
    return { pushed: false, localRows: scan.currentRows, cloudRows: scan.cloudRows }
  }

  await syncAllCachedBasesToCloud()
  return { pushed: true, localRows: scan.currentRows, cloudRows: scan.cloudRows }
}

async function flushOnExit(workspaceIds: string[]) {
  await flushCacheToLocalStorageAsync()
  if (!isFirebaseConfigured() || workspaceIds.length === 0) return
  const localRows = countAllBaseRows(getCache().bases)
  if (localRows === 0) return
  try {
    await syncAllCachedBasesToCloud()
  } catch (error) {
    console.warn('Exit cloud sync failed (IndexedDB still has your data):', error)
  }
}

/** Keep IndexedDB and Firestore in sync; flush before tab close or background. */
export function installRecordSafetyHooks(getWorkspaceIds: () => string[]) {
  if (typeof window === 'undefined') return () => {}

  const onPageHide = () => {
    void flushOnExit(getWorkspaceIds())
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') onPageHide()
  }

  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)

  const intervalId = window.setInterval(() => {
    const now = Date.now()
    if (now - lastBackgroundSyncAt < BACKGROUND_SYNC_MS) return
    lastBackgroundSyncAt = now
    void pushLocalToCloudIfAhead(getWorkspaceIds())
  }, BACKGROUND_SYNC_MS)

  return () => {
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.clearInterval(intervalId)
  }
}

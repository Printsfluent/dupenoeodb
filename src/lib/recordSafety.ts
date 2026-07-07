import { countAllBaseRows } from './baseMerge'
import { getCache } from './dataStore'
import { isFirebaseConfigured } from './firebase'
import { flushCacheToLocalStorageAsync } from './localPersistence'
import { syncAllCachedBasesToCloud, isCloudSyncInProgress } from './firestoreSync'

const BACKGROUND_SYNC_MS = 2 * 60 * 1000
let lastBackgroundSyncAt = 0

/** Save IndexedDB + upload to Firestore when this browser has more rows than the cloud. */
export async function pushLocalToCloudIfAhead(
  workspaceIds: string[],
): Promise<{ pushed: boolean; localRows: number; cloudRows: number }> {
  if (!isFirebaseConfigured() || workspaceIds.length === 0) {
    return { pushed: false, localRows: countAllBaseRows(getCache().bases), cloudRows: 0 }
  }

  const localRows = countAllBaseRows(getCache().bases)
  if (localRows === 0) {
    return { pushed: false, localRows: 0, cloudRows: 0 }
  }

  if (isCloudSyncInProgress()) {
    return { pushed: false, localRows, cloudRows: 0 }
  }

  await flushCacheToLocalStorageAsync()
  await syncAllCachedBasesToCloud()
  return { pushed: true, localRows, cloudRows: 0 }
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
    if (isCloudSyncInProgress()) return
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
    if (isCloudSyncInProgress()) return
    lastBackgroundSyncAt = now
    void pushLocalToCloudIfAhead(getWorkspaceIds())
  }, BACKGROUND_SYNC_MS)

  return () => {
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.clearInterval(intervalId)
  }
}

const BASES_HISTORY_KEY = 'gridvault_bases_history'
const BASES_BACKUP_KEY = 'gridvault_bases_backup'
export const BASES_MAIN_KEY = 'gridvault_bases'

/** Keys that hold full base row data — safe to drop from localStorage when IndexedDB has a copy. */
export const LARGE_LOCAL_STORAGE_KEYS = [BASES_MAIN_KEY, BASES_BACKUP_KEY, BASES_HISTORY_KEY] as const

export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  return (
    error.name === 'QuotaExceededError' ||
    error.code === 22 ||
    error.code === 1014
  )
}

/** Remove bulky recovery copies so the app can keep running. */
export function pruneStorageBloat() {
  try {
    localStorage.removeItem(BASES_HISTORY_KEY)
  } catch {
    // ignore
  }
}

export function safeSetItem(key: string, value: string, options?: { idbFallback?: boolean }): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error
    pruneStorageBloat()
    try {
      localStorage.setItem(key, value)
      return true
    } catch (retryError) {
      if (!isQuotaExceededError(retryError)) throw retryError
      if (options?.idbFallback || LARGE_LOCAL_STORAGE_KEYS.includes(key as (typeof LARGE_LOCAL_STORAGE_KEYS)[number])) {
        console.warn(
          `Browser storage full — skipped saving "${key}". Full table data is kept in IndexedDB on this device.`,
        )
      } else {
        console.warn(`Browser storage full — skipped saving "${key}".`)
      }
      return false
    }
  }
}

export function safeWriteJson<T>(key: string, value: T, options?: { idbFallback?: boolean }): boolean {
  return safeSetItem(key, JSON.stringify(value), options)
}

/** Remove bulky base copies from localStorage after IndexedDB has the full data. */
export function freeLocalStorageForLargeBases() {
  pruneStorageBloat()
  for (const key of LARGE_LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

/** Drop oversized history on startup so a prior session cannot brick the app. */
export function pruneOversizedHistoryOnStartup() {
  try {
    const raw = localStorage.getItem(BASES_HISTORY_KEY)
    if (!raw) return
    if (raw.length < 500_000) return
    localStorage.removeItem(BASES_HISTORY_KEY)
    console.warn('Removed oversized local record history to free browser storage.')
  } catch {
    // ignore
  }
}

export function clearStorageBloat() {
  pruneStorageBloat()
  try {
    localStorage.removeItem(BASES_BACKUP_KEY)
  } catch {
    // ignore
  }
}

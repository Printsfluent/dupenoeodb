const BASES_HISTORY_KEY = 'gridvault_bases_history'
const BASES_BACKUP_KEY = 'gridvault_bases_backup'

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

export function safeSetItem(key: string, value: string): boolean {
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
      console.warn(`Browser storage full — skipped saving "${key}". Data still syncs via Firebase.`)
      return false
    }
  }
}

export function safeWriteJson<T>(key: string, value: T): boolean {
  return safeSetItem(key, JSON.stringify(value))
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

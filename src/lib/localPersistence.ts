import type { Base, PlanId, Session } from '../types'
import { countBaseRows, resolveBaseConflict } from './baseMerge'
import { isBaseNewer } from './baseUpdated'
import { normalizeBase } from './tableSchema'
import {
  loadAllBasesFromIdb,
  loadArchivedBasesFromIdb,
  mergeStoredBases,
  saveAllBasesToIdb,
} from './baseLocalStore'
import {
  getCache,
  setActivityEvents,
  setAppNotifications,
  setBases,
  setInvites,
  setMembers,
  setPendingPlans,
  setTeams,
  setUsers,
  setWorkspaces,
} from './dataStore'
import {
  BASES_MAIN_KEY,
  freeLocalStorageForLargeBases,
  pruneOversizedHistoryOnStartup,
  safeWriteJson,
} from './safeStorage'

const KEYS = {
  users: 'gridvault_users',
  session: 'gridvault_session',
  workspaces: 'gridvault_workspaces',
  bases: BASES_MAIN_KEY,
  basesBackup: 'gridvault_bases_backup',
  members: 'gridvault_members',
  teams: 'gridvault_teams',
  invites: 'gridvault_invites',
  pendingPlans: 'gridvault_pending_plans',
  activity: 'gridvault_activity',
  notifications: 'gridvault_notifications',
} as const

/** Above this size, full bases stay in IndexedDB only (Safari localStorage is ~5MB). */
const MAX_LOCALSTORAGE_BASES_BYTES = 400_000

const PERSIST_DEBOUNCE_MS = 500
let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistChain: Promise<void> = Promise.resolve()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  safeWriteJson(key, value)
}

function readLocalStorageBases(): Base[] {
  const stored = read<Base[]>(KEYS.bases, [])
  if (stored.length > 0 && stored.every((base) => Array.isArray(base.tables))) {
    return stored
  }
  const backup = read<Base[]>(KEYS.basesBackup, [])
  if (backup.length > 0 && backup.every((base) => Array.isArray(base.tables))) {
    return backup
  }
  return []
}

export async function hydrateCacheFromStorage() {
  pruneOversizedHistoryOnStartup()

  setUsers(read(KEYS.users, []))
  setWorkspaces(read(KEYS.workspaces, []))

  const idbBases = await loadAllBasesFromIdb()
  const archivedBases = await loadArchivedBasesFromIdb()
  const localStorageBases = readLocalStorageBases()
  const mergedBases = mergeStoredBases(localStorageBases, [...idbBases, ...archivedBases])

  if (mergedBases.length > 0) {
    setBases(mergedBases.map(normalizeBase))
    // Keep IndexedDB authoritative and free Safari localStorage when bases are large.
    if (idbBases.length > 0 || archivedBases.length > 0) {
      await saveAllBasesToIdb(mergedBases)
      const payload = JSON.stringify(mergedBases)
      if (payload.length > MAX_LOCALSTORAGE_BASES_BYTES) {
        freeLocalStorageForLargeBases()
      }
    }
  }

  setMembers(read(KEYS.members, []))
  setTeams(read(KEYS.teams, []))
  setInvites(read(KEYS.invites, []))
  setPendingPlans(read<Record<string, PlanId>>(KEYS.pendingPlans, {}))
  setActivityEvents(read(KEYS.activity, []))
  setAppNotifications(read(KEYS.notifications, []))
}

/** @deprecated Use hydrateCacheFromStorage */
export function hydrateCacheFromLocalStorage() {
  void hydrateCacheFromStorage()
}

async function writeCacheNow() {
  try {
    const cache = getCache()
    const previousBases = readLocalStorageBases()
    const previousById = new Map<string, Base>(previousBases.map((base) => [base.id, base]))
    const safeBases = cache.bases.map((incoming) => {
      const previous = previousById.get(incoming.id)
      if (!previous) return incoming
      return resolveBaseConflict(previous, incoming)
    })

    // IndexedDB first — large tables exceed Safari localStorage quota.
    await saveAllBasesToIdb(safeBases)

    const basesPayload = JSON.stringify(safeBases)
    if (basesPayload.length <= MAX_LOCALSTORAGE_BASES_BYTES) {
      const savedMain = safeWriteJson(KEYS.bases, safeBases, { idbFallback: true })
      const backupBases = read<Base[]>(KEYS.basesBackup, [])
      const backupById = new Map<string, Base>(backupBases.map((base) => [base.id, base]))
      const shouldUpdateBackup = safeBases.some((base) => {
        const backup = backupById.get(base.id)
        return !backup || isBaseNewer(base, backup) || countBaseRows(base) > countBaseRows(backup)
      })
      if (shouldUpdateBackup && savedMain) {
        safeWriteJson(KEYS.basesBackup, safeBases, { idbFallback: true })
      }
    } else {
      freeLocalStorageForLargeBases()
    }

    write(KEYS.users, cache.users)
    write(KEYS.workspaces, cache.workspaces)
    write(KEYS.members, cache.members)
    write(KEYS.teams, cache.teams)
    write(KEYS.invites, cache.invites)
    write(KEYS.pendingPlans, cache.pendingPlans)
    write(KEYS.activity, cache.activityEvents)
    write(KEYS.notifications, cache.appNotifications)
  } catch (error) {
    console.warn('Failed to persist cache:', error)
  }
}

function queuePersist() {
  persistChain = persistChain.then(() => writeCacheNow()).catch((error) => {
    console.warn('Failed to persist cache:', error)
  })
  return persistChain
}

export function persistCacheToLocalStorage() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void queuePersist()
  }, PERSIST_DEBOUNCE_MS)
}

export function flushCacheToLocalStorage() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  void queuePersist()
}

export async function flushCacheToLocalStorageAsync() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await queuePersist()
}

export function getLocalSession(): Session | null {
  return read<Session | null>(KEYS.session, null)
}

export function setLocalSession(session: Session | null) {
  if (session) write(KEYS.session, session)
  else localStorage.removeItem(KEYS.session)
}

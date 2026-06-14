import type { PlanId, Session } from '../types'
import { countAllBaseRows, mergeBasesList } from './baseMerge'
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
import { pruneOversizedHistoryOnStartup, safeWriteJson } from './safeStorage'

const KEYS = {
  users: 'gridvault_users',
  session: 'gridvault_session',
  workspaces: 'gridvault_workspaces',
  bases: 'gridvault_bases',
  basesBackup: 'gridvault_bases_backup',
  members: 'gridvault_members',
  teams: 'gridvault_teams',
  invites: 'gridvault_invites',
  pendingPlans: 'gridvault_pending_plans',
  activity: 'gridvault_activity',
  notifications: 'gridvault_notifications',
} as const

const PERSIST_DEBOUNCE_MS = 500
let persistTimer: ReturnType<typeof setTimeout> | null = null

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

export function hydrateCacheFromLocalStorage() {
  pruneOversizedHistoryOnStartup()
  setUsers(read(KEYS.users, []))
  setWorkspaces(read(KEYS.workspaces, []))
  const storedBases = read(KEYS.bases, [])
  const backupBases = read(KEYS.basesBackup, [])
  setBases(mergeBasesList(storedBases, backupBases))
  setMembers(read(KEYS.members, []))
  setTeams(read(KEYS.teams, []))
  setInvites(read(KEYS.invites, []))
  setPendingPlans(read<Record<string, PlanId>>(KEYS.pendingPlans, {}))
  setActivityEvents(read(KEYS.activity, []))
  setAppNotifications(read(KEYS.notifications, []))
}

function writeCacheNow() {
  try {
    const cache = getCache()
    const previousBases = read(KEYS.bases, [])
    const backupBases = read(KEYS.basesBackup, [])
    const mergedBases = mergeBasesList(previousBases, cache.bases)
    const safeBases =
      countAllBaseRows(mergedBases) >= countAllBaseRows(previousBases)
        ? mergedBases
        : mergeBasesList(previousBases, mergedBases)

    if (countAllBaseRows(safeBases) > countAllBaseRows(cache.bases)) {
      setBases(safeBases)
    }

    write(KEYS.users, cache.users)
    write(KEYS.workspaces, cache.workspaces)
    write(KEYS.bases, safeBases)

    if (countAllBaseRows(safeBases) > countAllBaseRows(backupBases)) {
      write(KEYS.basesBackup, safeBases)
    }

    write(KEYS.members, cache.members)
    write(KEYS.teams, cache.teams)
    write(KEYS.invites, cache.invites)
    write(KEYS.pendingPlans, cache.pendingPlans)
    write(KEYS.activity, cache.activityEvents)
    write(KEYS.notifications, cache.appNotifications)
  } catch (error) {
    console.warn('Failed to persist cache to localStorage:', error)
  }
}

export function persistCacheToLocalStorage() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    writeCacheNow()
  }, PERSIST_DEBOUNCE_MS)
}

export function flushCacheToLocalStorage() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  writeCacheNow()
}

export function getLocalSession(): Session | null {
  return read<Session | null>(KEYS.session, null)
}

export function setLocalSession(session: Session | null) {
  if (session) write(KEYS.session, session)
  else localStorage.removeItem(KEYS.session)
}

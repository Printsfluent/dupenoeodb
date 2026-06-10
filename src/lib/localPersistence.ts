import type { PlanId, Session } from '../types'
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

const KEYS = {
  users: 'gridvault_users',
  session: 'gridvault_session',
  workspaces: 'gridvault_workspaces',
  bases: 'gridvault_bases',
  members: 'gridvault_members',
  teams: 'gridvault_teams',
  invites: 'gridvault_invites',
  pendingPlans: 'gridvault_pending_plans',
  activity: 'gridvault_activity',
  notifications: 'gridvault_notifications',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function hydrateCacheFromLocalStorage() {
  setUsers(read(KEYS.users, []))
  setWorkspaces(read(KEYS.workspaces, []))
  setBases(read(KEYS.bases, []))
  setMembers(read(KEYS.members, []))
  setTeams(read(KEYS.teams, []))
  setInvites(read(KEYS.invites, []))
  setPendingPlans(read<Record<string, PlanId>>(KEYS.pendingPlans, {}))
  setActivityEvents(read(KEYS.activity, []))
  setAppNotifications(read(KEYS.notifications, []))
}

export function persistCacheToLocalStorage() {
  const cache = getCache()
  write(KEYS.users, cache.users)
  write(KEYS.workspaces, cache.workspaces)
  write(KEYS.bases, cache.bases)
  write(KEYS.members, cache.members)
  write(KEYS.teams, cache.teams)
  write(KEYS.invites, cache.invites)
  write(KEYS.pendingPlans, cache.pendingPlans)
  write(KEYS.activity, cache.activityEvents)
  write(KEYS.notifications, cache.appNotifications)
}

export function getLocalSession(): Session | null {
  return read<Session | null>(KEYS.session, null)
}

export function setLocalSession(session: Session | null) {
  if (session) write(KEYS.session, session)
  else localStorage.removeItem(KEYS.session)
}

import type {
  Base,
  PlanId,
  Team,
  User,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
} from '../types'

export interface DataCache {
  users: User[]
  workspaces: Workspace[]
  bases: Base[]
  members: WorkspaceMember[]
  teams: Team[]
  invites: WorkspaceInvite[]
  pendingPlans: Record<string, PlanId>
}

const emptyCache = (): DataCache => ({
  users: [],
  workspaces: [],
  bases: [],
  members: [],
  teams: [],
  invites: [],
  pendingPlans: {},
})

let cache: DataCache = emptyCache()
const listeners = new Set<() => void>()

export function getCache(): DataCache {
  return cache
}

export function clearDataCache() {
  cache = emptyCache()
  notify()
}

export function subscribeDataCache(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((item) => [item.id, item]))
  incoming.forEach((item) => map.set(item.id, item))
  return Array.from(map.values())
}

function removeById<T extends { id: string }>(existing: T[], removedIds: string[]): T[] {
  if (removedIds.length === 0) return existing
  const remove = new Set(removedIds)
  return existing.filter((item) => !remove.has(item.id))
}

export function setUsers(users: User[], removedIds: string[] = []) {
  cache.users = removeById(mergeById(cache.users, users), removedIds)
  notify()
}

export function setWorkspaces(workspaces: Workspace[], removedIds: string[] = []) {
  cache.workspaces = removeById(mergeById(cache.workspaces, workspaces), removedIds)
  notify()
}

export function setBases(bases: Base[], removedIds: string[] = []) {
  cache.bases = removeById(mergeById(cache.bases, bases), removedIds)
  notify()
}

export function setMembers(members: WorkspaceMember[], removedIds: string[] = []) {
  cache.members = removeById(mergeById(cache.members, members), removedIds)
  notify()
}

export function setTeams(teams: Team[], removedIds: string[] = []) {
  cache.teams = removeById(mergeById(cache.teams, teams), removedIds)
  notify()
}

export function setInvites(invites: WorkspaceInvite[], removedIds: string[] = []) {
  cache.invites = removeById(mergeById(cache.invites, invites), removedIds)
  notify()
}

export function setPendingPlans(plans: Record<string, PlanId>) {
  cache.pendingPlans = { ...cache.pendingPlans, ...plans }
  notify()
}

export function removePendingPlan(email: string) {
  const key = email.trim().toLowerCase()
  if (!(key in cache.pendingPlans)) return
  const { [key]: _removed, ...rest } = cache.pendingPlans
  cache.pendingPlans = rest
  notify()
}

export function replaceMembersForWorkspace(workspaceId: string, members: WorkspaceMember[]) {
  cache.members = [
    ...cache.members.filter((member) => member.workspaceId !== workspaceId),
    ...members,
  ]
  notify()
}

export function replaceTeamsForWorkspace(workspaceId: string, teams: Team[]) {
  cache.teams = [
    ...cache.teams.filter((team) => team.workspaceId !== workspaceId),
    ...teams,
  ]
  notify()
}

export function replaceBasesForWorkspace(workspaceId: string, bases: Base[]) {
  cache.bases = [
    ...cache.bases.filter((base) => base.workspaceId !== workspaceId),
    ...bases,
  ]
  notify()
}

import type { Base, PlanId, Table, User, Workspace, WorkspaceSettings } from '../types'
import { createId } from './id'
import { pickWorkspaceColor } from './colors'
import { createSlug } from './slug'
import { getCache } from './dataStore'
import {
  clearPendingPlanDoc,
  deleteBaseDoc,
  deleteWorkspaceCascade,
  persistBase,
  persistBases,
  persistPendingPlan,
  persistUser,
  persistWorkspace,
} from './firestoreSync'
import {
  ensureUserIsOwner,
  getAllMembers,
  getAllTeams,
  getUserMemberWorkspaceIds,
  migrateMembersData,
} from './members'

function defaultSettings(): WorkspaceSettings {
  return { allowMembersToLeave: true }
}

export function getPendingPlans(): Record<string, PlanId> {
  return getCache().pendingPlans
}

export function getPendingPlanForEmail(email: string): PlanId | undefined {
  return getCache().pendingPlans[email.trim().toLowerCase()]
}

export function clearPendingPlanForEmail(email: string) {
  void clearPendingPlanDoc(email)
}

export function assignUserPlan(
  userId: string | null,
  email: string,
  plan: PlanId,
  managed = true,
): { ok: true; user?: User } | { ok: false; error: string } {
  const normalizedEmail = email.trim().toLowerCase()

  if (userId) {
    const users = getUsers()
    const index = users.findIndex((u) => u.id === userId)
    if (index === -1) return { ok: false, error: 'User not found' }

    const updated = { ...users[index], plan, planManaged: managed }
    void persistUser(updated)
    void clearPendingPlanDoc(normalizedEmail)
    return { ok: true, user: updated }
  }

  void persistPendingPlan(normalizedEmail, plan)
  return { ok: true }
}

export function getResolvedPlan(userId: string | null, email: string): PlanId {
  if (userId) {
    const user = getUserById(userId)
    if (user?.plan) return user.plan
  }

  const pending = getPendingPlanForEmail(email)
  if (pending) return pending

  return 'free'
}

export function getUsers(): User[] {
  return getCache().users
}

export function setUserPlan(userId: string, plan: PlanId, managed = false): User | null {
  const existing = getUsers().find((u) => u.id === userId)
  if (!existing) return null
  const result = assignUserPlan(userId, existing.email, plan, managed)
  return result.ok ? result.user ?? null : null
}

export function saveUsers(users: User[]) {
  users.forEach((user) => void persistUser(user))
}

export function getUserById(userId: string): User | undefined {
  return getUsers().find((u) => u.id === userId)
}

export function getUserAvatarEmoji(userId: string | null, email: string): string | undefined {
  const user = userId
    ? getUsers().find((u) => u.id === userId)
    : getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase())
  return user?.avatarEmoji
}

export function updateUserAvatar(userId: string, emoji: string | null): User | null {
  const user = getUserById(userId)
  if (!user) return null

  const updated = { ...user }
  if (emoji) updated.avatarEmoji = emoji
  else delete updated.avatarEmoji

  void persistUser(updated)
  return updated
}

function migrateWorkspaceFields(workspaces: Workspace[]): Workspace[] {
  return workspaces.map((w) => {
    const legacy = w as Workspace & { userId?: string }
    const ownerId = legacy.ownerId ?? legacy.userId ?? ''
    const slug = legacy.slug ?? createSlug()
    const settings = legacy.settings ?? defaultSettings()
    return { ...w, ownerId, slug, settings }
  })
}

export function getWorkspaces(): Workspace[] {
  return migrateWorkspaceFields(getCache().workspaces)
}

export function saveWorkspaces(workspaces: Workspace[]) {
  workspaces.forEach((workspace) => void persistWorkspace(workspace))
}

export function getBases(): Base[] {
  return getCache().bases
}

export function saveBases(bases: Base[]) {
  void persistBases(bases)
}

function defaultTable(): Table {
  const colName = createId()
  const colCompany = createId()
  const colStatus = createId()
  const colRevenue = createId()

  return {
    id: createId(),
    name: 'Table 1',
    columns: [
      { id: colName, name: 'Name', type: 'singleLineText' },
      { id: colCompany, name: 'Company', type: 'singleLineText' },
      { id: colStatus, name: 'Status', type: 'singleLineText' },
      { id: colRevenue, name: 'Revenue', type: 'number' },
    ],
    rows: [
      { id: createId(), cells: { [colName]: 'Sarah Chen', [colCompany]: 'Acme Corp', [colStatus]: 'Active', [colRevenue]: '42000' } },
      { id: createId(), cells: { [colName]: 'Marcus Webb', [colCompany]: 'NovaTech', [colStatus]: 'Lead', [colRevenue]: '18500' } },
      { id: createId(), cells: { [colName]: 'Elena Rossi', [colCompany]: 'BrightPath', [colStatus]: 'Active', [colRevenue]: '67200' } },
    ],
  }
}

export function createEmptyTable(name = 'Table 1'): Table {
  const col = createId()
  return {
    id: createId(),
    name,
    columns: [{ id: col, name: 'Title', type: 'singleLineText' }],
    rows: [],
  }
}

export function createWorkspace(ownerId: string, name: string, colorIndex = 0): Workspace {
  return {
    id: createId(),
    slug: createSlug(),
    ownerId,
    name,
    color: pickWorkspaceColor(colorIndex),
    settings: defaultSettings(),
    createdAt: new Date().toISOString(),
  }
}

export function createBase(workspaceId: string, userId: string, name: string, withSample = false): Base {
  return {
    id: createId(),
    workspaceId,
    userId,
    name,
    tables: [withSample ? defaultTable() : createEmptyTable()],
    createdAt: new Date().toISOString(),
  }
}

export function repairWorkspaceForUser(
  workspace: Workspace,
  user: { id: string; email: string; name: string },
): Workspace {
  const legacy = workspace as Workspace & { userId?: string }
  const ownerId = workspace.ownerId || legacy.userId || user.id

  let updated = workspace
  if (!workspace.ownerId || workspace.ownerId !== ownerId) {
    updated = { ...workspace, ownerId }
    void persistWorkspace(updated)
  }

  if (ownerId === user.id) {
    ensureUserIsOwner(updated.id, ownerId, user)
  }

  return getWorkspaces().find((w) => w.id === workspace.id) ?? updated
}

export function getUserWorkspaces(userId: string, email?: string): Workspace[] {
  const all = getWorkspaces()
  const memberIds = email ? getUserMemberWorkspaceIds(userId, email) : []
  return all.filter((w) => w.ownerId === userId || memberIds.includes(w.id))
}

export function getWorkspaceBases(workspaceId: string): Base[] {
  return getBases().filter((b) => b.workspaceId === workspaceId)
}

export function upsertWorkspace(workspace: Workspace) {
  void persistWorkspace(workspace)
}

export function upsertBase(base: Base) {
  void persistBase(base)
}

export function deleteWorkspace(workspaceId: string) {
  const members = getAllMembers().filter((member) => member.workspaceId === workspaceId)
  const teams = getAllTeams().filter((team) => team.workspaceId === workspaceId)
  const bases = getBases().filter((base) => base.workspaceId === workspaceId)
  void deleteWorkspaceCascade(workspaceId, members, teams, bases)
}

export function deleteBase(baseId: string) {
  void deleteBaseDoc(baseId)
}

export function migrateMembersDataForWorkspaces(workspaces: Workspace[]) {
  migrateMembersData(workspaces)
}

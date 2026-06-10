import { collection, getDocs, query, where } from 'firebase/firestore'
import type { Team, WorkspaceMember, MemberRole, WorkspaceInvite } from '../types'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'
import { COL } from './firestoreSync'
import { createId } from './id'
import { pickWorkspaceColor } from './colors'
import { getUsers, getWorkspaceBases, getWorkspaces, upsertBase } from './storage'
import { getCache, replaceMembersForWorkspace } from './dataStore'
import {
  ensureWorkspaceDataInCache,
  deleteMemberDocs,
  persistMember,
  persistMembers,
  persistInvite,
  persistTeam,
  persistTeams,
  deleteTeamDoc,
} from './firestoreSync'
import {
  cancelInviteByMemberId,
  createWorkspaceInvite,
  getAllInvites,
  linkInvitesToUser,
} from './invites'
import { logActivity } from './activity'
import { createAppNotification } from './notifications'
import { canEditRecords, isAdminRole, normalizeMemberRole } from './roles'

const MEMBER_STATUS_RANK: Record<WorkspaceMember['status'], number> = {
  active: 4,
  pending: 3,
  blocked: 2,
  left: 1,
}

const MEMBER_ROLE_RANK: Record<MemberRole, number> = {
  owner: 5,
  admin: 4,
  creator: 4,
  editor: 3,
  viewer: 2,
  no_access: 1,
}

/** Stable Firestore doc id so re-sync does not create duplicate member rows. */
export function memberDocId(
  workspaceId: string,
  identity: { userId?: string | null; email: string },
): string {
  const email = identity.email.trim().toLowerCase()
  if (identity.userId) return `${workspaceId}__${identity.userId}`
  const safeEmail = email.replace(/@/g, '_at_').replace(/[^a-z0-9._-]/g, '_')
  return `${workspaceId}__email__${safeEmail}`
}

function memberPriority(member: WorkspaceMember): number {
  return MEMBER_ROLE_RANK[member.role] * 10 + MEMBER_STATUS_RANK[member.status]
}

function isSameWorkspaceMember(a: WorkspaceMember, b: WorkspaceMember): boolean {
  if (a.workspaceId !== b.workspaceId) return false
  const emailA = a.email.toLowerCase()
  const emailB = b.email.toLowerCase()
  if (emailA === emailB) return true
  return !!(a.userId && b.userId && a.userId === b.userId)
}

export function dedupeWorkspaceMembersList(members: WorkspaceMember[]): {
  keep: WorkspaceMember[]
  remove: WorkspaceMember[]
} {
  const pool = members.filter((member) => member.status !== 'left')
  const keep: WorkspaceMember[] = []
  const remove: WorkspaceMember[] = []
  const handled = new Set<string>()

  for (const member of pool) {
    if (handled.has(member.id)) continue
    const dupes = pool.filter(
      (candidate) => !handled.has(candidate.id) && isSameWorkspaceMember(candidate, member),
    )
    dupes.forEach((candidate) => handled.add(candidate.id))
    if (dupes.length === 1) {
      keep.push(dupes[0])
      continue
    }
    const sorted = [...dupes].sort(
      (a, b) =>
        memberPriority(b) - memberPriority(a) ||
        a.joinedAt.localeCompare(b.joinedAt) ||
        a.id.localeCompare(b.id),
    )
    keep.push(sorted[0])
    remove.push(...sorted.slice(1))
  }

  return { keep, remove }
}

export function applyWorkspaceMembersFromFirestore(
  workspaceId: string,
  members: WorkspaceMember[],
) {
  const workspaceMembers = members.filter((member) => member.workspaceId === workspaceId)
  const { keep, remove } = dedupeWorkspaceMembersList(workspaceMembers)
  replaceMembersForWorkspace(workspaceId, keep)
  if (remove.length > 0) {
    void deleteMemberDocs(remove.map((member) => member.id))
  }
}

export function getAllMembers(): WorkspaceMember[] {
  return getCache().members
}

export function saveAllMembers(members: WorkspaceMember[]) {
  void persistMembers(members)
}

export function getAllTeams(): Team[] {
  return getCache().teams
}

export function saveAllTeams(teams: Team[]) {
  void persistTeams(teams)
}

export function getWorkspaceMembers(workspaceId: string): WorkspaceMember[] {
  const members = getAllMembers().filter(
    (member) => member.workspaceId === workspaceId && member.status !== 'left',
  )
  return dedupeWorkspaceMembersList(members).keep
}

export function getWorkspaceTeams(workspaceId: string): Team[] {
  return getAllTeams().filter((t) => t.workspaceId === workspaceId)
}

export function getMemberByUser(workspaceId: string, userId: string): WorkspaceMember | undefined {
  return getWorkspaceMembers(workspaceId).find((m) => m.userId === userId)
}

export function getMemberForUser(
  workspaceId: string,
  userId: string,
  email: string,
): WorkspaceMember | undefined {
  const normalized = email.toLowerCase()
  return getWorkspaceMembers(workspaceId).find(
    (m) => m.userId === userId || m.email === normalized,
  )
}

export function isWorkspaceOwner(_workspaceId: string, userId: string, ownerId: string) {
  return !!ownerId && ownerId === userId
}

function isActiveWorkspaceMember(member: WorkspaceMember | undefined): member is WorkspaceMember {
  return !!member && member.status === 'active' && member.role !== 'no_access'
}

/** True when this user created the workspace (logged-in account owner). */
export function isWorkspaceAccountOwner(
  workspace: { ownerId: string },
  userId: string,
): boolean {
  return !!workspace.ownerId && workspace.ownerId === userId
}

/**
 * Owner and Admin can manage databases, invite members, and configure tables.
 */
export function hasFullWorkspaceAccess(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  if (isWorkspaceAccountOwner(workspace, userId)) return true
  const member = getMemberForUser(workspaceId, userId, email)
  return isActiveWorkspaceMember(member) && isAdminRole(member.role)
}

export function canCreateInWorkspace(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  return hasFullWorkspaceAccess(workspace, userId, email, workspaceId)
}

/** Column/field schema changes — admins only. */
export function canEditFieldsInWorkspace(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  return hasFullWorkspaceAccess(workspace, userId, email, workspaceId)
}

export function canModifyTableSchemaInWorkspace(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  return hasFullWorkspaceAccess(workspace, userId, email, workspaceId)
}

/** @deprecated Use hasFullWorkspaceAccess */
export const hasWorkspaceFullAccess = hasFullWorkspaceAccess

export function canEditInWorkspace(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  if (hasFullWorkspaceAccess(workspace, userId, email, workspaceId)) return true
  const member = getMemberForUser(workspaceId, userId, email)
  return isActiveWorkspaceMember(member) && canEditRecords(member.role)
}

export function canViewInWorkspace(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  if (isWorkspaceOwner(workspaceId, userId, workspace.ownerId)) return true
  const member = getMemberForUser(workspaceId, userId, email)
  if (!member || member.status === 'blocked' || member.role === 'no_access') return false
  return member.status === 'active'
}

export function canInviteToWorkspace(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  return hasFullWorkspaceAccess(workspace, userId, email, workspaceId)
}

export function canManageTeams(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  return hasFullWorkspaceAccess(workspace, userId, email, workspaceId)
}

export function canManageMembers(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  return hasFullWorkspaceAccess(workspace, userId, email, workspaceId)
}

/** Admins can remove, block, and moderate members (workspace creator is protected). */
export function canRemoveWorkspaceMembers(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  return hasFullWorkspaceAccess(workspace, userId, email, workspaceId)
}

export function getWorkspaceRoleLabel(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): MemberRole {
  if (isWorkspaceAccountOwner(workspace, userId)) return 'admin'
  const member = getMemberForUser(workspaceId, userId, email)
  return member ? normalizeMemberRole(member.role) : 'viewer'
}

export function isWorkspaceCreatorMember(
  workspace: { ownerId: string },
  member: WorkspaceMember,
): boolean {
  return member.userId === workspace.ownerId
}

/** Upgrade legacy owner/creator member roles to admin for consistent permissions. */
export function migrateWorkspaceMemberRoles(workspaceId: string) {
  getWorkspaceMembers(workspaceId).forEach((member) => {
    if (member.role === 'owner' || member.role === 'creator') {
      updateMember({ ...member, role: 'admin' })
    }
  })
}

export function ensureUserIsOwner(
  workspaceId: string,
  ownerId: string,
  user: { id: string; email: string; name: string },
) {
  if (ownerId !== user.id) return

  const matches = getAllMembers().filter(
    (member) =>
      member.workspaceId === workspaceId &&
      (member.userId === user.id || member.email === user.email.toLowerCase()),
  )

  if (matches.length > 1) {
    const { keep, remove } = dedupeWorkspaceMembersList(matches)
    if (remove.length > 0) void deleteMemberDocs(remove.map((member) => member.id))
    matches.splice(0, matches.length, keep[0])
  }

  const existing = matches[0]
  if (!existing) {
    void persistMember(createOwnerMember(workspaceId, user))
    return
  }

  if (
    normalizeMemberRole(existing.role) !== 'admin' ||
    existing.status !== 'active' ||
    existing.userId !== user.id
  ) {
    updateMember({
      ...existing,
      userId: user.id,
      role: 'admin',
      status: 'active',
      tableAccess: [],
    })
  }
}

export function createOwnerMember(
  workspaceId: string,
  user: { id: string; email: string; name: string },
): WorkspaceMember {
  return {
    id: memberDocId(workspaceId, { userId: user.id, email: user.email }),
    workspaceId,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: 'admin',
    status: 'active',
    teamIds: [],
    tableAccess: [],
    joinedAt: new Date().toISOString(),
  }
}

/** In-app invite: pick an existing SheetFlow user (no email delivery). */
export function sendWorkspaceInviteToUser(
  workspaceId: string,
  targetUserId: string,
  teamIds: string[],
  role: MemberRole,
  invitedBy: { id: string; name: string; email: string },
): { ok: boolean; error?: string; member?: WorkspaceMember } {
  if (targetUserId === invitedBy.id) {
    return { ok: false, error: 'You cannot invite yourself' }
  }

  const targetUser = getUsers().find((u) => u.id === targetUserId)
  if (!targetUser) return { ok: false, error: 'User not found' }

  const trimmed = targetUser.email.trim().toLowerCase()
  const members = getAllMembers()
  const existing = members.find(
    (m) =>
      m.workspaceId === workspaceId &&
      (m.userId === targetUserId || m.email === trimmed) &&
      m.status !== 'left',
  )
  if (existing) {
    if (existing.status === 'pending') {
      return { ok: false, error: 'Invite already sent to this user' }
    }
    return { ok: false, error: 'User is already in this workspace' }
  }

  const workspace = getWorkspaces().find((w) => w.id === workspaceId)
  if (!workspace) return { ok: false, error: 'Workspace not found' }

  if (!canInviteToWorkspace(workspace, invitedBy.id, invitedBy.email, workspaceId)) {
    return { ok: false, error: 'You do not have permission to invite members' }
  }

  const normalizedRole = normalizeMemberRole(role === 'owner' ? 'admin' : role)
  if (!['admin', 'editor', 'viewer'].includes(normalizedRole)) {
    return { ok: false, error: 'Invalid role for invite' }
  }

  const memberRole: MemberRole = normalizedRole === 'admin' ? 'admin' : normalizedRole

  const member: WorkspaceMember = {
    id: memberDocId(workspaceId, { userId: targetUserId, email: trimmed }),
    workspaceId,
    userId: targetUserId,
    email: trimmed,
    name: targetUser.name,
    role: memberRole,
    status: 'pending',
    teamIds,
    tableAccess: [],
    joinedAt: new Date().toISOString(),
  }

  void persistMember(member)

  createWorkspaceInvite({
    workspaceId,
    workspaceName: workspace.name,
    memberId: member.id,
    email: trimmed,
    role: memberRole,
    teamIds,
    invitedBy: invitedBy.id,
    invitedByName: invitedBy.name,
    userId: targetUserId,
  })

  createAppNotification({
    userId: targetUserId,
    type: 'workspace_invite',
    title: `Invited to ${workspace.name}`,
    body: `${invitedBy.name} invited you as ${memberRole}`,
    href: '/app',
  })

  logActivity({
    workspaceId,
    action: 'member_invited',
    actorId: invitedBy.id,
    actorName: invitedBy.name,
    targetLabel: targetUser.name,
  })

  return { ok: true, member }
}

/** @deprecated Use sendWorkspaceInviteToUser for in-app invites */
export function sendWorkspaceInvite(
  workspaceId: string,
  email: string,
  teamIds: string[],
  role: MemberRole,
  invitedBy: { id: string; name: string; email: string },
): { ok: boolean; error?: string; member?: WorkspaceMember } {
  const trimmed = email.trim().toLowerCase()
  const matchedUser = getUsers().find((u) => u.email === trimmed)
  if (!matchedUser) {
    return { ok: false, error: 'User must have a SheetFlow account — search by name or email' }
  }
  return sendWorkspaceInviteToUser(workspaceId, matchedUser.id, teamIds, role, invitedBy)
}

function inviteBelongsToUser(
  invite: { email: string; userId?: string | null },
  user: { id: string; email: string },
) {
  const normalizedEmail = user.email.toLowerCase()
  return invite.email === normalizedEmail || invite.userId === user.id
}

function findInviteMember(invite: WorkspaceInvite): WorkspaceMember | undefined {
  const byId = getAllMembers().find((member) => member.id === invite.memberId)
  if (byId) return byId

  const normalized = invite.email.toLowerCase()
  return getAllMembers().find(
    (member) =>
      member.workspaceId === invite.workspaceId &&
      member.email.toLowerCase() === normalized &&
      member.status !== 'left',
  )
}

export async function ensureWorkspaceMembersInCache(workspaceId: string) {
  if (!isFirebaseConfigured()) return

  try {
    const snapshot = await getDocs(
      query(collection(getFirestoreDb(), COL.members), where('workspaceId', '==', workspaceId)),
    )
    applyWorkspaceMembersFromFirestore(
      workspaceId,
      snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as WorkspaceMember)),
    )
  } catch (error) {
    console.warn('ensureWorkspaceMembersInCache:', error)
  }
}

export async function acceptWorkspaceInviteAsync(
  inviteId: string,
  user: { id: string; email: string; name: string },
): Promise<{ ok: boolean; error?: string; workspaceId?: string }> {
  const invite = getAllInvites().find(
    (item) => item.id === inviteId && item.status === 'pending',
  )
  if (!invite) return { ok: false, error: 'Invite not found' }
  if (!inviteBelongsToUser(invite, user)) {
    return { ok: false, error: 'This invite is not for your account' }
  }

  const member = findInviteMember(invite)
  if (!member || member.status !== 'pending') {
    return { ok: false, error: 'Invite is no longer valid' }
  }

  const updatedMember: WorkspaceMember = {
    ...member,
    userId: user.id,
    name: user.name,
    status: 'active',
    joinedAt: new Date().toISOString(),
  }

  const updatedInvite: WorkspaceInvite = {
    ...invite,
    status: 'accepted',
    userId: user.id,
    memberId: member.id,
  }

  await persistMember(updatedMember)

  if (updatedMember.teamIds.length > 0) {
    await Promise.all(
      getAllTeams()
        .filter(
          (team) =>
            updatedMember.teamIds.includes(team.id) &&
            !team.memberIds.includes(updatedMember.id),
        )
        .map((team) =>
          persistTeam({ ...team, memberIds: [...team.memberIds, updatedMember.id] }),
        ),
    )
  }

  await persistInvite(updatedInvite)
  await ensureWorkspaceMembersInCache(invite.workspaceId)
  await ensureWorkspaceDataInCache(invite.workspaceId)

  const workspace = getWorkspaces().find((w) => w.id === invite.workspaceId)
  logActivity({
    workspaceId: invite.workspaceId,
    action: 'invite_accepted',
    actorId: user.id,
    actorName: user.name,
    targetLabel: workspace?.name ?? invite.workspaceName,
  })

  return { ok: true, workspaceId: invite.workspaceId }
}

export async function declineWorkspaceInviteAsync(
  inviteId: string,
  user: { id: string; email: string },
): Promise<{ ok: boolean; error?: string }> {
  const invite = getAllInvites().find(
    (item) => item.id === inviteId && item.status === 'pending',
  )
  if (!invite) return { ok: false, error: 'Invite not found' }
  if (!inviteBelongsToUser(invite, user)) {
    return { ok: false, error: 'This invite is not for your account' }
  }

  const member = findInviteMember(invite)
  if (member) {
    await persistMember({ ...member, status: 'left' })
  }
  await persistInvite({ ...invite, status: 'declined' })

  return { ok: true }
}

/** Revoke a pending invite before the invited person accepts (workspace owner/creator). */
export async function cancelWorkspaceInviteAsync(
  memberId: string,
  actor: { workspace: { ownerId: string }; userId: string; email: string; workspaceId: string },
): Promise<{ ok: boolean; error?: string }> {
  const member = getAllMembers().find((item) => item.id === memberId)
  if (!member || member.workspaceId !== actor.workspaceId) {
    return { ok: false, error: 'Invite not found' }
  }
  if (member.status !== 'pending') {
    return { ok: false, error: 'Only pending invites can be canceled' }
  }
  if (!canInviteToWorkspace(actor.workspace, actor.userId, actor.email, actor.workspaceId)) {
    return { ok: false, error: 'You do not have permission to cancel invites' }
  }

  const pendingInvites = getAllInvites().filter(
    (invite) => invite.memberId === memberId && invite.status === 'pending',
  )

  await persistMember({ ...member, status: 'left' })
  await Promise.all(
    pendingInvites.map((invite) => persistInvite({ ...invite, status: 'revoked' })),
  )

  return { ok: true }
}

export function createTeam(
  workspaceId: string,
  name: string,
  createdBy: string,
  colorIndex = 0,
): Team {
  const team: Team = {
    id: createId(),
    workspaceId,
    name: name.trim(),
    color: pickWorkspaceColor(colorIndex),
    memberIds: [],
    createdBy,
    createdAt: new Date().toISOString(),
  }
  void persistTeam(team)
  return team
}

export function updateMember(member: WorkspaceMember) {
  void persistMember(member)
}

export function updateTeam(team: Team) {
  void persistTeam(team)
}

export function deleteTeam(teamId: string) {
  void deleteTeamDoc(teamId)
  getAllMembers().forEach((member) => {
    if (member.teamIds.includes(teamId)) {
      void persistMember({
        ...member,
        teamIds: member.teamIds.filter((id) => id !== teamId),
      })
    }
  })
}

export function setMemberRole(
  memberId: string,
  role: MemberRole,
  actor?: { id: string; name: string },
) {
  const member = getAllMembers().find((m) => m.id === memberId)
  const workspace = member
    ? getWorkspaces().find((w) => w.id === member.workspaceId)
    : undefined
  if (!member || !workspace || isWorkspaceCreatorMember(workspace, member)) return
  const nextRole = normalizeMemberRole(role)
  updateMember({ ...member, role: nextRole })
  if (member.userId && actor) {
    createAppNotification({
      userId: member.userId,
      type: 'role_changed',
      title: 'Your workspace role changed',
      body: `You are now ${nextRole} in the workspace`,
    })
    logActivity({
      workspaceId: member.workspaceId,
      action: 'role_changed',
      actorId: actor.id,
      actorName: actor.name,
      targetLabel: member.name,
    })
  }
}

export function setMemberTableAccess(memberId: string, tableIds: string[]) {
  const member = getAllMembers().find((m) => m.id === memberId)
  const workspace = member
    ? getWorkspaces().find((w) => w.id === member.workspaceId)
    : undefined
  if (!member || !workspace || isWorkspaceCreatorMember(workspace, member)) return
  updateMember({ ...member, tableAccess: tableIds })
}

/** Assign teams to any workspace member (syncs team.memberIds). */
export function setMemberTeams(
  workspaceId: string,
  memberId: string,
  teamIds: string[],
): { ok: boolean; error?: string } {
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member || member.workspaceId !== workspaceId) {
    return { ok: false, error: 'Member not found' }
  }
  if (member.status === 'left') {
    return { ok: false, error: 'Cannot assign teams to removed members' }
  }

  const workspaceTeams = getWorkspaceTeams(workspaceId)
  const uniqueTeamIds = [
    ...new Set(teamIds.filter((id) => workspaceTeams.some((team) => team.id === id))),
  ]

  updateMember({ ...member, teamIds: uniqueTeamIds })

  workspaceTeams.forEach((team) => {
    const shouldInclude = uniqueTeamIds.includes(team.id)
    const hasMember = team.memberIds.includes(memberId)
    if (shouldInclude && !hasMember) {
      void persistTeam({ ...team, memberIds: [...team.memberIds, memberId] })
    } else if (!shouldInclude && hasMember) {
      void persistTeam({
        ...team,
        memberIds: team.memberIds.filter((id) => id !== memberId),
      })
    }
  })

  return { ok: true }
}

export function assignMemberTeams(
  workspace: { ownerId: string },
  workspaceId: string,
  memberId: string,
  teamIds: string[],
  actor: { userId: string; email: string },
): { ok: boolean; error?: string } {
  if (!hasFullWorkspaceAccess(workspace, actor.userId, actor.email, workspaceId)) {
    return { ok: false, error: 'You do not have permission to assign teams' }
  }
  return setMemberTeams(workspaceId, memberId, teamIds)
}

export function blockMember(
  memberId: string,
  actor?: { workspace: { ownerId: string }; userId: string; email: string; workspaceId: string },
) {
  if (actor && !canRemoveWorkspaceMembers(actor.workspace, actor.userId, actor.email, actor.workspaceId)) {
    return
  }
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member) return
  if (actor && member.userId === actor.workspace.ownerId) return
  updateMember({ ...member, status: 'blocked', role: 'no_access' })
}

export function unblockMember(
  memberId: string,
  actor?: { workspace: { ownerId: string }; userId: string; email: string; workspaceId: string },
) {
  if (actor && !canRemoveWorkspaceMembers(actor.workspace, actor.userId, actor.email, actor.workspaceId)) {
    return
  }
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member) return
  updateMember({
    ...member,
    status: 'active',
    role: member.role === 'no_access' ? 'viewer' : normalizeMemberRole(member.role),
  })
}

export function removeMember(
  memberId: string,
  actor?: { workspace: { ownerId: string }; userId: string; email: string; workspaceId: string },
) {
  if (actor && !canRemoveWorkspaceMembers(actor.workspace, actor.userId, actor.email, actor.workspaceId)) {
    return
  }
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member) return
  if (actor && member.userId === actor.workspace.ownerId) return
  cancelInviteByMemberId(memberId)
  updateMember({ ...member, status: 'left' })
  getAllTeams().forEach((team) => {
    if (team.memberIds.includes(memberId)) {
      void persistTeam({
        ...team,
        memberIds: team.memberIds.filter((id) => id !== memberId),
      })
    }
  })
}

export function memberLeaveWorkspace(workspaceId: string, userId: string) {
  const member = getMemberByUser(workspaceId, userId)
  const workspace = getWorkspaces().find((w) => w.id === workspaceId)
  if (!member || (workspace && isWorkspaceAccountOwner(workspace, userId))) {
    return { ok: false, error: 'Workspace admins cannot leave — transfer or delete the workspace instead' }
  }
  removeMember(member.id)
  return { ok: true }
}

export function getUserMemberWorkspaceIds(userId: string, email: string): string[] {
  return getAllMembers()
    .filter(
      (m) =>
        m.status === 'active' &&
        (m.userId === userId || m.email === email.toLowerCase()),
    )
    .map((m) => m.workspaceId)
}

export function memberCanAccessTable(
  member: WorkspaceMember | undefined,
  tableId: string,
  options?: { tableTeamIds?: string[]; bypassForAdmin?: boolean },
): boolean {
  if (options?.bypassForAdmin) return true
  if (!member || member.status === 'blocked' || member.role === 'no_access') return false
  if (isAdminRole(member.role)) return true

  const tableTeamIds = options?.tableTeamIds ?? []
  if (tableTeamIds.length > 0) {
    const inAssignedTeam = tableTeamIds.some((teamId) => member.teamIds.includes(teamId))
    if (!inAssignedTeam) return false
  }

  if (member.tableAccess.length > 0) {
    return member.tableAccess.includes(tableId)
  }

  return true
}

export function setTableTeamAccess(
  workspaceId: string,
  baseId: string,
  tableId: string,
  teamIds: string[],
): { ok: boolean; error?: string } {
  const base = getWorkspaceBases(workspaceId).find((item) => item.id === baseId)
  if (!base) return { ok: false, error: 'Database not found' }

  const workspaceTeams = getWorkspaceTeams(workspaceId)
  const validTeamIds = [
    ...new Set(teamIds.filter((id) => workspaceTeams.some((team) => team.id === id))),
  ]

  const table = base.tables.find((item) => item.id === tableId)
  if (!table) return { ok: false, error: 'Table not found' }

  void upsertBase({
    ...base,
    tables: base.tables.map((item) =>
      item.id === tableId ? { ...item, teamIds: validTeamIds } : item,
    ),
  })

  return { ok: true }
}

export function assignTableTeams(
  workspace: { ownerId: string },
  workspaceId: string,
  baseId: string,
  tableId: string,
  teamIds: string[],
  actor: { userId: string; email: string },
): { ok: boolean; error?: string } {
  if (!hasFullWorkspaceAccess(workspace, actor.userId, actor.email, workspaceId)) {
    return { ok: false, error: 'You do not have permission to assign table teams' }
  }
  return setTableTeamAccess(workspaceId, baseId, tableId, teamIds)
}

export function ensureOwnerMember(
  workspaceId: string,
  owner: { id: string; email: string; name: string },
) {
  const matches = getAllMembers().filter(
    (member) =>
      member.workspaceId === workspaceId &&
      (member.userId === owner.id || member.email === owner.email.toLowerCase()),
  )
  if (matches.length === 0) {
    void persistMember(createOwnerMember(workspaceId, owner))
    return
  }
  if (matches.length > 1) {
    const { remove } = dedupeWorkspaceMembersList(matches)
    if (remove.length > 0) void deleteMemberDocs(remove.map((member) => member.id))
  }
}

export function linkMemberAccounts(user: { id: string; email: string; name: string }) {
  linkInvitesToUser(user)
  getAllMembers().forEach((member) => {
    if (member.email === user.email.toLowerCase() && member.userId !== user.id) {
      void persistMember({ ...member, userId: user.id, name: user.name })
    }
  })
}

export function migrateMembersData(workspaces: { id: string; ownerId?: string; userId?: string }[]) {
  const users = getUsers()
  const members = getAllMembers()

  for (const ws of workspaces) {
    const ownerId = ws.ownerId ?? (ws as { userId?: string }).userId
    if (!ownerId) continue
    const owner = users.find((u) => u.id === ownerId)
    if (!owner) continue
    const matches = members.filter(
      (member) =>
        member.workspaceId === ws.id &&
        (member.userId === ownerId || member.email === owner.email.toLowerCase()),
    )
    if (matches.length === 0) {
      void persistMember(createOwnerMember(ws.id, owner))
    } else if (matches.length > 1) {
      const { remove } = dedupeWorkspaceMembersList(matches)
      if (remove.length > 0) void deleteMemberDocs(remove.map((member) => member.id))
    }
  }
}

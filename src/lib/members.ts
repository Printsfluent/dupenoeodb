import type { Team, WorkspaceMember, MemberRole } from '../types'
import { createId } from './id'
import { pickWorkspaceColor } from './colors'
import { getUsers, getWorkspaces } from './storage'
import { getCache } from './dataStore'
import {
  persistMember,
  persistMembers,
  persistTeam,
  persistTeams,
  deleteTeamDoc,
} from './firestoreSync'
import {
  cancelInviteByMemberId,
  createWorkspaceInvite,
  getAllInvites,
  linkInvitesToUser,
  updateInvite,
} from './invites'

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
  return getAllMembers().filter(
    (m) => m.workspaceId === workspaceId && m.status !== 'left',
  )
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

export function canCreateInWorkspace(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  if (isWorkspaceOwner(workspaceId, userId, workspace.ownerId)) return true
  const member = getMemberForUser(workspaceId, userId, email)
  return isActiveWorkspaceMember(member) && member.role === 'creator'
}

/** @deprecated Use canCreateInWorkspace */
export const hasWorkspaceFullAccess = canCreateInWorkspace

export function canEditInWorkspace(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  if (isWorkspaceOwner(workspaceId, userId, workspace.ownerId)) return true
  const member = getMemberForUser(workspaceId, userId, email)
  return isActiveWorkspaceMember(member) && (member.role === 'creator' || member.role === 'editor')
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
  if (isWorkspaceOwner(workspaceId, userId, workspace.ownerId)) return true
  const member = getMemberForUser(workspaceId, userId, email)
  return isActiveWorkspaceMember(member) && member.role === 'creator'
}

export function canManageTeams(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  return canInviteToWorkspace(workspace, userId, email, workspaceId)
}

export function canManageMembers(
  workspace: { ownerId: string },
  userId: string,
  email: string,
  workspaceId: string,
): boolean {
  if (isWorkspaceOwner(workspaceId, userId, workspace.ownerId)) return true
  const member = getMemberForUser(workspaceId, userId, email)
  return member?.role === 'owner'
}

export function ensureUserIsOwner(
  workspaceId: string,
  ownerId: string,
  user: { id: string; email: string; name: string },
) {
  if (ownerId !== user.id) return

  const members = getAllMembers()
  const existing = members.find(
    (m) => m.workspaceId === workspaceId && (m.userId === user.id || m.email === user.email.toLowerCase()),
  )

  if (!existing) {
    void persistMember(createOwnerMember(workspaceId, user))
    return
  }

  if (existing.role !== 'owner' || existing.status !== 'active') {
    updateMember({
      ...existing,
      userId: user.id,
      role: 'owner',
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
    id: createId(),
    workspaceId,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: 'owner',
    status: 'active',
    teamIds: [],
    tableAccess: [],
    joinedAt: new Date().toISOString(),
  }
}

export function sendWorkspaceInvite(
  workspaceId: string,
  email: string,
  teamIds: string[],
  role: MemberRole,
  invitedBy: { id: string; name: string; email: string },
): { ok: boolean; error?: string; member?: WorkspaceMember } {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed.includes('@')) return { ok: false, error: 'Enter a valid email' }
  if (trimmed === invitedBy.email.toLowerCase()) {
    return { ok: false, error: 'You cannot invite yourself' }
  }

  const members = getAllMembers()
  const existing = members.find(
    (m) =>
      m.workspaceId === workspaceId &&
      m.email === trimmed &&
      m.status !== 'left',
  )
  if (existing) {
    if (existing.status === 'pending') {
      return { ok: false, error: 'Invite already sent to this email' }
    }
    return { ok: false, error: 'Member already in workspace' }
  }

  const workspace = getWorkspaces().find((w) => w.id === workspaceId)
  if (!workspace) return { ok: false, error: 'Workspace not found' }

  if (!canInviteToWorkspace(workspace, invitedBy.id, invitedBy.email, workspaceId)) {
    return { ok: false, error: 'You do not have permission to invite members' }
  }

  const inviteRole = role === 'owner' ? 'creator' : role
  if (!['creator', 'editor', 'viewer'].includes(inviteRole)) {
    return { ok: false, error: 'Invalid role for invite' }
  }

  const matchedUser = getUsers().find((u) => u.email === trimmed)
  const memberRole = inviteRole as MemberRole

  const member: WorkspaceMember = {
    id: createId(),
    workspaceId,
    userId: matchedUser?.id ?? null,
    email: trimmed,
    name: matchedUser?.name ?? trimmed.split('@')[0],
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
    userId: matchedUser?.id ?? null,
  })

  return { ok: true, member }
}

function inviteBelongsToUser(
  invite: { email: string; userId?: string | null },
  user: { id: string; email: string },
) {
  const normalizedEmail = user.email.toLowerCase()
  return invite.email === normalizedEmail || invite.userId === user.id
}

export function acceptWorkspaceInvite(
  inviteId: string,
  user: { id: string; email: string; name: string },
): { ok: boolean; error?: string; workspaceId?: string } {
  const invite = getAllInvites().find(
    (i) => i.id === inviteId && i.status === 'pending',
  )
  if (!invite) return { ok: false, error: 'Invite not found' }
  if (!inviteBelongsToUser(invite, user)) {
    return { ok: false, error: 'This invite is not for your account' }
  }

  const member = getAllMembers().find((m) => m.id === invite.memberId)
  if (!member || member.status !== 'pending') {
    return { ok: false, error: 'Invite is no longer valid' }
  }

  updateMember({
    ...member,
    userId: user.id,
    name: user.name,
    status: 'active',
    joinedAt: new Date().toISOString(),
  })

  if (member.teamIds.length > 0) {
    getAllTeams().forEach((team) => {
      if (member.teamIds.includes(team.id) && !team.memberIds.includes(member.id)) {
        void persistTeam({ ...team, memberIds: [...team.memberIds, member.id] })
      }
    })
  }

  updateInvite({ ...invite, status: 'accepted', userId: user.id })

  return { ok: true, workspaceId: invite.workspaceId }
}

export function declineWorkspaceInvite(
  inviteId: string,
  user: { id: string; email: string },
): { ok: boolean; error?: string } {
  const invite = getAllInvites().find(
    (i) => i.id === inviteId && i.status === 'pending',
  )
  if (!invite) return { ok: false, error: 'Invite not found' }
  if (!inviteBelongsToUser(invite, user)) {
    return { ok: false, error: 'This invite is not for your account' }
  }

  const member = getAllMembers().find((m) => m.id === invite.memberId)
  if (member) {
    updateMember({ ...member, status: 'left' })
  }
  updateInvite({ ...invite, status: 'declined' })

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

export function setMemberRole(memberId: string, role: MemberRole) {
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member || member.role === 'owner') return
  updateMember({ ...member, role })
}

export function setMemberTableAccess(memberId: string, tableIds: string[]) {
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member || member.role === 'owner') return
  updateMember({ ...member, tableAccess: tableIds })
}

export function blockMember(memberId: string) {
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member || member.role === 'owner') return
  updateMember({ ...member, status: 'blocked', role: 'no_access' })
}

export function unblockMember(memberId: string) {
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member || member.role === 'owner') return
  updateMember({ ...member, status: 'active', role: member.role === 'no_access' ? 'viewer' : member.role })
}

export function removeMember(memberId: string) {
  const member = getAllMembers().find((m) => m.id === memberId)
  if (!member || member.role === 'owner') return
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
  if (!member || member.role === 'owner') return { ok: false, error: 'Owners cannot leave' }
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
  canCreate: boolean,
): boolean {
  if (canCreate) return true
  if (!member || member.status === 'blocked' || member.role === 'no_access') return false
  if (member.role === 'owner' || member.role === 'creator') return true
  if (member.tableAccess.length === 0) return true
  return member.tableAccess.includes(tableId)
}

export function ensureOwnerMember(
  workspaceId: string,
  owner: { id: string; email: string; name: string },
) {
  const members = getAllMembers()
  const exists = members.some(
    (m) => m.workspaceId === workspaceId && m.userId === owner.id && m.role === 'owner',
  )
  if (!exists) {
    void persistMember(createOwnerMember(workspaceId, owner))
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
    const exists = members.some(
      (m) => m.workspaceId === ws.id && m.role === 'owner',
    )
    if (!exists) {
      void persistMember(createOwnerMember(ws.id, owner))
    }
  }
}

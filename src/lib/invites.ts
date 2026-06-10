import type { MemberRole, WorkspaceInvite } from '../types'
import { createId } from './id'
import { getCache } from './dataStore'
import { persistInvite, persistInvites } from './firestoreSync'

export function getAllInvites(): WorkspaceInvite[] {
  return getCache().invites
}

export function saveAllInvites(invites: WorkspaceInvite[]) {
  void persistInvites(invites)
}

export function getPendingInvitesForUser(userId: string, email: string): WorkspaceInvite[] {
  const normalized = email.toLowerCase()
  return getAllInvites().filter(
    (i) =>
      i.status === 'pending' &&
      (i.email === normalized || i.userId === userId),
  )
}

export function getPendingInviteCount(userId: string, email: string): number {
  return getPendingInvitesForUser(userId, email).length
}

export function createWorkspaceInvite(data: {
  workspaceId: string
  workspaceName: string
  memberId: string
  email: string
  role: MemberRole
  teamIds: string[]
  invitedBy: string
  invitedByName: string
  userId?: string | null
}): WorkspaceInvite {
  const invite: WorkspaceInvite = {
    id: createId(),
    workspaceId: data.workspaceId,
    workspaceName: data.workspaceName,
    memberId: data.memberId,
    email: data.email.toLowerCase(),
    userId: data.userId ?? null,
    role: data.role,
    teamIds: data.teamIds,
    invitedBy: data.invitedBy,
    invitedByName: data.invitedByName,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  void persistInvite(invite)
  return invite
}

export function updateInvite(invite: WorkspaceInvite) {
  void persistInvite(invite)
}

export function cancelInviteByMemberId(memberId: string) {
  getAllInvites().forEach((invite) => {
    if (invite.memberId === memberId && invite.status === 'pending') {
      void persistInvite({ ...invite, status: 'declined' })
    }
  })
}

export function linkInvitesToUser(user: { id: string; email: string }) {
  getAllInvites().forEach((invite) => {
    if (invite.email === user.email.toLowerCase() && invite.userId !== user.id) {
      void persistInvite({ ...invite, userId: user.id })
    }
  })
}

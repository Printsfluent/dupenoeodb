import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type {
  Base,
  PlanId,
  Team,
  User,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
} from '../types'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'
import {
  getCache,
  removePendingPlan,
  setBases,
  setInvites,
  setMembers,
  setPendingPlans,
  setTeams,
  setUsers,
  setWorkspaces,
} from './dataStore'

export const COL = {
  users: 'users',
  workspaces: 'workspaces',
  bases: 'bases',
  members: 'members',
  teams: 'teams',
  invites: 'invites',
  pendingPlans: 'pendingPlans',
} as const

function pendingPlanDocId(email: string) {
  return email.trim().toLowerCase().replace(/\//g, '_')
}

function logSyncError(action: string, error: unknown) {
  console.warn(`Firestore sync failed (${action}):`, error)
}

function skipCloudSync() {
  return !isFirebaseConfigured()
}

export async function persistUser(user: User) {
  setUsers([user])
  if (skipCloudSync()) return
  try {
    const { password: _password, ...profile } = user as User & { password?: string }
    await setDoc(doc(getFirestoreDb(), COL.users, user.id), profile, { merge: true })
  } catch (error) {
    logSyncError('persistUser', error)
  }
}

export async function persistUsers(users: User[]) {
  setUsers(users)
  if (skipCloudSync()) return
  try {
    const batch = writeBatch(getFirestoreDb())
    users.forEach((user) => {
      const { password: _password, ...profile } = user as User & { password?: string }
      batch.set(doc(getFirestoreDb(), COL.users, user.id), profile, { merge: true })
    })
    await batch.commit()
  } catch (error) {
    logSyncError('persistUsers', error)
  }
}

export async function persistWorkspace(workspace: Workspace) {
  setWorkspaces([workspace])
  if (skipCloudSync()) return
  try {
    await setDoc(doc(getFirestoreDb(), COL.workspaces, workspace.id), workspace, { merge: true })
  } catch (error) {
    logSyncError('persistWorkspace', error)
  }
}

export async function ensureWorkspaceInCache(workspaceId: string): Promise<Workspace | null> {
  const cached = getCache().workspaces.find((workspace) => workspace.id === workspaceId)
  if (cached) return cached

  if (skipCloudSync()) return null

  try {
    const snapshot = await getDoc(doc(getFirestoreDb(), COL.workspaces, workspaceId))
    if (!snapshot.exists()) return null
    const workspace = { id: snapshot.id, ...snapshot.data() } as Workspace
    setWorkspaces([workspace])
    return workspace
  } catch (error) {
    logSyncError('ensureWorkspaceInCache', error)
    return null
  }
}

export async function persistWorkspaces(workspaces: Workspace[]) {
  setWorkspaces(workspaces)
  if (skipCloudSync()) return
  try {
    const batch = writeBatch(getFirestoreDb())
    workspaces.forEach((workspace) => {
      batch.set(doc(getFirestoreDb(), COL.workspaces, workspace.id), workspace, { merge: true })
    })
    await batch.commit()
  } catch (error) {
    logSyncError('persistWorkspaces', error)
  }
}

export async function deleteWorkspaceDoc(workspaceId: string) {
  setWorkspaces([], [workspaceId])
  if (skipCloudSync()) return
  try {
    await deleteDoc(doc(getFirestoreDb(), COL.workspaces, workspaceId))
  } catch (error) {
    logSyncError('deleteWorkspace', error)
  }
}

export async function deleteWorkspaceCascade(
  workspaceId: string,
  members: WorkspaceMember[],
  teams: Team[],
  bases: Base[],
) {
  setWorkspaces([], [workspaceId])
  setMembers([], members.map((member) => member.id))
  setTeams([], teams.map((team) => team.id))
  setBases([], bases.map((base) => base.id))

  if (skipCloudSync()) return
  try {
    const batch = writeBatch(getFirestoreDb())
    batch.delete(doc(getFirestoreDb(), COL.workspaces, workspaceId))
    members.forEach((member) => batch.delete(doc(getFirestoreDb(), COL.members, member.id)))
    teams.forEach((team) => batch.delete(doc(getFirestoreDb(), COL.teams, team.id)))
    bases.forEach((base) => batch.delete(doc(getFirestoreDb(), COL.bases, base.id)))
    await batch.commit()
  } catch (error) {
    logSyncError('deleteWorkspaceCascade', error)
  }
}

export async function persistBase(base: Base) {
  setBases([base])
  if (skipCloudSync()) return
  try {
    await setDoc(doc(getFirestoreDb(), COL.bases, base.id), base, { merge: true })
  } catch (error) {
    logSyncError('persistBase', error)
  }
}

export async function persistBases(bases: Base[]) {
  setBases(bases)
  if (skipCloudSync()) return
  try {
    const batch = writeBatch(getFirestoreDb())
    bases.forEach((base) => {
      batch.set(doc(getFirestoreDb(), COL.bases, base.id), base, { merge: true })
    })
    await batch.commit()
  } catch (error) {
    logSyncError('persistBases', error)
  }
}

export async function deleteBaseDoc(baseId: string) {
  setBases([], [baseId])
  if (skipCloudSync()) return
  try {
    await deleteDoc(doc(getFirestoreDb(), COL.bases, baseId))
  } catch (error) {
    logSyncError('deleteBase', error)
  }
}

export async function persistMember(member: WorkspaceMember) {
  setMembers([member])
  if (skipCloudSync()) return
  try {
    await setDoc(doc(getFirestoreDb(), COL.members, member.id), member, { merge: true })
  } catch (error) {
    logSyncError('persistMember', error)
  }
}

export async function deleteMemberDocs(memberIds: string[]) {
  if (memberIds.length === 0) return
  setMembers([], memberIds)
  if (skipCloudSync()) return
  try {
    const batch = writeBatch(getFirestoreDb())
    memberIds.forEach((memberId) => {
      batch.delete(doc(getFirestoreDb(), COL.members, memberId))
    })
    await batch.commit()
  } catch (error) {
    logSyncError('deleteMemberDocs', error)
  }
}

export async function persistMembers(members: WorkspaceMember[]) {
  setMembers(members)
  if (skipCloudSync()) return
  try {
    const batch = writeBatch(getFirestoreDb())
    members.forEach((member) => {
      batch.set(doc(getFirestoreDb(), COL.members, member.id), member, { merge: true })
    })
    await batch.commit()
  } catch (error) {
    logSyncError('persistMembers', error)
  }
}

export async function persistTeam(team: Team) {
  setTeams([team])
  if (skipCloudSync()) return
  try {
    await setDoc(doc(getFirestoreDb(), COL.teams, team.id), team, { merge: true })
  } catch (error) {
    logSyncError('persistTeam', error)
  }
}

export async function persistTeams(teams: Team[]) {
  setTeams(teams)
  if (skipCloudSync()) return
  try {
    const batch = writeBatch(getFirestoreDb())
    teams.forEach((team) => {
      batch.set(doc(getFirestoreDb(), COL.teams, team.id), team, { merge: true })
    })
    await batch.commit()
  } catch (error) {
    logSyncError('persistTeams', error)
  }
}

export async function deleteTeamDoc(teamId: string) {
  setTeams([], [teamId])
  if (skipCloudSync()) return
  try {
    await deleteDoc(doc(getFirestoreDb(), COL.teams, teamId))
  } catch (error) {
    logSyncError('deleteTeam', error)
  }
}

export async function persistInvite(invite: WorkspaceInvite) {
  setInvites([invite])
  if (skipCloudSync()) return
  try {
    await setDoc(doc(getFirestoreDb(), COL.invites, invite.id), invite, { merge: true })
  } catch (error) {
    logSyncError('persistInvite', error)
  }
}

export async function persistInvites(invites: WorkspaceInvite[]) {
  setInvites(invites)
  if (skipCloudSync()) return
  try {
    const batch = writeBatch(getFirestoreDb())
    invites.forEach((invite) => {
      batch.set(doc(getFirestoreDb(), COL.invites, invite.id), invite, { merge: true })
    })
    await batch.commit()
  } catch (error) {
    logSyncError('persistInvites', error)
  }
}

export async function persistPendingPlan(email: string, plan: PlanId) {
  const key = email.trim().toLowerCase()
  setPendingPlans({ [key]: plan })
  if (skipCloudSync()) return
  try {
    await setDoc(doc(getFirestoreDb(), COL.pendingPlans, pendingPlanDocId(key)), { email: key, plan })
  } catch (error) {
    logSyncError('persistPendingPlan', error)
  }
}

export async function clearPendingPlanDoc(email: string) {
  const key = email.trim().toLowerCase()
  removePendingPlan(key)
  if (skipCloudSync()) return
  try {
    await deleteDoc(doc(getFirestoreDb(), COL.pendingPlans, pendingPlanDocId(key)))
  } catch (error) {
    logSyncError('clearPendingPlan', error)
  }
}

export async function hasAnyUsers(): Promise<boolean> {
  if (skipCloudSync()) {
    const { getCache } = await import('./dataStore')
    return getCache().users.length > 0
  }
  try {
    const snap = await getDocs(query(collection(getFirestoreDb(), COL.users), limit(1)))
    return !snap.empty
  } catch (error) {
    logSyncError('hasAnyUsers', error)
    return false
  }
}

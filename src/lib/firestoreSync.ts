import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type {
  ActivityEvent,
  AppNotification,
  Base,
  PlanId,
  Team,
  User,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
} from '../types'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'
import { countBaseRows, pickRicherBase, resolveBaseConflict } from './baseMerge'
import { isBaseNewer, stampBase } from './baseUpdated'
import { inlineAttachmentRefsInBase } from './attachments'
import {
  deleteTableRowsFromCloud,
  hydrateBaseRowsFromCloud,
  stripRowsFromBaseMetadata,
  writeTableRowsToCloud,
} from './baseRowSync'
import { deleteBaseFromIdb } from './baseLocalStore'
import { normalizeBase } from './tableSchema'
import {
  getCache,
  mergeBasesForWorkspace,
  removePendingPlan,
  replaceTeamsForWorkspace,
  setBases,
  setActivityEvents,
  setAppNotifications,
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
  activity: 'activity',
  notifications: 'notifications',
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

export async function ensureWorkspaceBasesInCache(workspaceId: string) {
  if (skipCloudSync()) return

  try {
    const snapshot = await getDocs(
      query(collection(getFirestoreDb(), COL.bases), where('workspaceId', '==', workspaceId)),
    )
    const remoteBases = await Promise.all(
      snapshot.docs.map(async (item) =>
        hydrateBaseRowsFromCloud(normalizeBase({ id: item.id, ...item.data() } as Base)),
      ),
    )
    const needsSync = mergeBasesForWorkspace(workspaceId, remoteBases)
    if (needsSync.length > 0) {
      await persistBases(needsSync)
    }
  } catch (error) {
    logSyncError('ensureWorkspaceBasesInCache', error)
  }
}

/** Fetch one database by id from offline cache and server, keeping the richest row data. */
export async function ensureBaseInCache(baseId: string): Promise<Base | null> {
  const cached = getCache().bases.find((base) => base.id === baseId)
  if (skipCloudSync()) return cached ?? null

  try {
    const ref = doc(getFirestoreDb(), COL.bases, baseId)
    let remote: Base | null = null

    try {
      const cacheSnap = await getDocFromCache(ref)
      if (cacheSnap.exists()) {
        remote = await hydrateBaseRowsFromCloud(
          normalizeBase({ id: cacheSnap.id, ...cacheSnap.data() } as Base),
        )
      }
    } catch {
      // no offline copy yet
    }

    try {
      const serverSnap = await getDoc(ref)
      if (serverSnap.exists()) {
        const serverBase = await hydrateBaseRowsFromCloud(
          normalizeBase({ id: serverSnap.id, ...serverSnap.data() } as Base),
        )
        remote = remote ? pickRicherBase(remote, serverBase) : serverBase
      }
    } catch (error) {
      logSyncError('ensureBaseInCache:getDoc', error)
    }

    if (!remote) return cached ?? null

    const merged = cached ? resolveBaseConflict(cached, remote) : remote
    setBases([merged])

    if (
      cached &&
      (isBaseNewer(merged, remote) ||
        countBaseRows(merged) > countBaseRows(remote) ||
        countBaseRows(cached) > countBaseRows(remote))
    ) {
      try {
        await writeBaseToCloud(merged)
      } catch (error) {
        logSyncError('ensureBaseInCache:push', error)
      }
    }

    return merged
  } catch (error) {
    logSyncError('ensureBaseInCache', error)
    return cached ?? null
  }
}

export async function ensureWorkspaceTeamsInCache(workspaceId: string) {
  if (skipCloudSync()) return

  try {
    const snapshot = await getDocs(
      query(collection(getFirestoreDb(), COL.teams), where('workspaceId', '==', workspaceId)),
    )
    replaceTeamsForWorkspace(
      workspaceId,
      snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Team)),
    )
  } catch (error) {
    logSyncError('ensureWorkspaceTeamsInCache', error)
  }
}

/** Load workspace, members, teams, and bases after joining or opening a shared workspace. */
export async function ensureWorkspaceDataInCache(workspaceId: string) {
  await ensureWorkspaceInCache(workspaceId)
  await Promise.all([
    ensureWorkspaceBasesInCache(workspaceId),
    ensureWorkspaceTeamsInCache(workspaceId),
  ])
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
    for (const base of bases) {
      await deleteTableRowsFromCloud(base.id)
    }
  } catch (error) {
    logSyncError('deleteWorkspaceCascade', error)
  }
}

const cloudPersistTimers = new Map<string, ReturnType<typeof setTimeout>>()
const CLOUD_PERSIST_DEBOUNCE_MS = 450

async function writeBaseToCloud(base: Base) {
  const normalized = normalizeBase(base)
  const withAttachments = await inlineAttachmentRefsInBase(normalized)
  const stamped = stampBase(withAttachments)
  const metadata = stripRowsFromBaseMetadata(stamped)
  await setDoc(doc(getFirestoreDb(), COL.bases, stamped.id), metadata)
  await writeTableRowsToCloud(stamped)
}

export async function flushPersistBase(baseId: string) {
  const existing = cloudPersistTimers.get(baseId)
  if (existing) {
    clearTimeout(existing)
    cloudPersistTimers.delete(baseId)
  }
  if (skipCloudSync()) return
  const latest = getCache().bases.find((item) => item.id === baseId)
  if (!latest) return
  try {
    await writeBaseToCloud(latest)
  } catch (error) {
    logSyncError('flushPersistBase', error)
  }
}

export async function persistBase(base: Base) {
  const stamped = stampBase(normalizeBase(base))
  setBases([stamped])
  if (skipCloudSync()) return

  const baseId = stamped.id
  const existing = cloudPersistTimers.get(baseId)
  if (existing) clearTimeout(existing)

  cloudPersistTimers.set(
    baseId,
    setTimeout(() => {
      cloudPersistTimers.delete(baseId)
      const latest = getCache().bases.find((item) => item.id === baseId) ?? stamped
      void writeBaseToCloud(latest).catch((error) => logSyncError('persistBase', error))
    }, CLOUD_PERSIST_DEBOUNCE_MS),
  )
}

export async function persistBases(bases: Base[]) {
  setBases(bases)
  if (skipCloudSync()) return
  try {
    for (const base of bases) {
      await writeBaseToCloud(base)
    }
  } catch (error) {
    logSyncError('persistBases', error)
  }
}

export async function deleteBaseDoc(baseId: string) {
  setBases([], [baseId])
  void deleteBaseFromIdb(baseId)
  if (skipCloudSync()) return
  try {
    await deleteTableRowsFromCloud(baseId)
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

export async function persistActivityEvent(event: ActivityEvent) {
  setActivityEvents([event])
  if (skipCloudSync()) return
  try {
    await setDoc(doc(getFirestoreDb(), COL.activity, event.id), event, { merge: true })
  } catch (error) {
    logSyncError('persistActivityEvent', error)
  }
}

export async function persistAppNotification(notification: AppNotification) {
  setAppNotifications([notification])
  if (skipCloudSync()) return
  try {
    await setDoc(doc(getFirestoreDb(), COL.notifications, notification.id), notification, {
      merge: true,
    })
  } catch (error) {
    logSyncError('persistAppNotification', error)
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

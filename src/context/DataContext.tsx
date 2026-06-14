import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured } from '../lib/firebase'
import { hydrateCacheFromLocalStorage, persistCacheToLocalStorage } from '../lib/localPersistence'
import { installRecoveryConsoleHelper, runStartupDataRecovery } from '../lib/dataRecovery'
import { COL, persistBases } from '../lib/firestoreSync'
import {
  clearDataCache,
  getCache,
  mergeBasesForWorkspace,
  replaceTeamsForWorkspace,
  setAppNotifications,
  setInvites,
  setMembers,
  setPendingPlans,
  setUsers,
  setWorkspaces,
  subscribeDataCache,
} from '../lib/dataStore'
import { applyWorkspaceMembersFromFirestore } from '../lib/members'
import type { PlanId, WorkspaceInvite } from '../types'

interface DataContextValue {
  ready: boolean
  online: boolean
  localMode: boolean
  workspaceIds: string[]
  cacheVersion: number
  recoveryMessage: string | null
  clearRecoveryMessage: () => void
  tryRecoverData: () => Promise<void>
}

const DataContext = createContext<DataContextValue>({
  ready: false,
  online: true,
  localMode: false,
  workspaceIds: [],
  cacheVersion: 0,
  recoveryMessage: null,
  clearRecoveryMessage: () => {},
  tryRecoverData: async () => {},
})

function computeWorkspaceIds(userId: string, email: string) {
  const cache = getCache()
  const normalized = email.toLowerCase()
  const owned = cache.workspaces
    .filter((workspace) => workspace.ownerId === userId)
    .map((workspace) => workspace.id)
  const member = cache.members
    .filter(
      (member) =>
        member.status === 'active' &&
        (member.userId === userId || member.email === normalized),
    )
    .map((member) => member.workspaceId)
  return [...new Set([...owned, ...member])]
}

export function DataProvider({
  userId,
  userEmail,
  children,
}: {
  userId: string | null
  userEmail: string | null
  children: ReactNode
}) {
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([])
  const [cacheVersion, setCacheVersion] = useState(0)
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)

  const clearRecoveryMessage = useCallback(() => setRecoveryMessage(null), [])

  const tryRecoverData = useCallback(async () => {
    if (!userId || !userEmail) return
    const ids = computeWorkspaceIds(userId, userEmail)
    const result = await runStartupDataRecovery(ids)
    if (result.restored) {
      setWorkspaceIds(computeWorkspaceIds(userId, userEmail))
      setCacheVersion((v) => v + 1)
      setRecoveryMessage(
        `Restored ${result.recoveredRows} records from ${result.sources.join(' and ')}.`,
      )
    } else {
      setRecoveryMessage(
        'No older records were found in this browser or offline cache. Try another device where you last edited the data.',
      )
    }
  }, [userId, userEmail])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => subscribeDataCache(() => setCacheVersion((v) => v + 1)), [])

  useEffect(() => {
    if (!userId || !userEmail) return
    return subscribeDataCache(() => {
      setWorkspaceIds(computeWorkspaceIds(userId, userEmail))
    })
  }, [userId, userEmail])

  useEffect(() => {
    if (!userId || !userEmail) return
    return subscribeDataCache(() => {
      persistCacheToLocalStorage()
      setWorkspaceIds(computeWorkspaceIds(userId, userEmail))
    })
  }, [userId, userEmail])

  useEffect(() => {
    if (!userId || !userEmail) {
      clearDataCache()
      setWorkspaceIds([])
      setReady(true)
      return
    }

    if (!isFirebaseConfigured()) {
      hydrateCacheFromLocalStorage()
      installRecoveryConsoleHelper()
      let cancelled = false
      void (async () => {
        const ids = computeWorkspaceIds(userId, userEmail)
        await runStartupDataRecovery(ids)
        if (!cancelled) {
          setWorkspaceIds(computeWorkspaceIds(userId, userEmail))
          setReady(true)
        }
      })()
      return () => {
        cancelled = true
      }
    }

    hydrateCacheFromLocalStorage()
    installRecoveryConsoleHelper()
    setWorkspaceIds(computeWorkspaceIds(userId, userEmail))

    let cancelled = false
    void (async () => {
      const ids = computeWorkspaceIds(userId, userEmail)
      const result = await runStartupDataRecovery(ids)
      if (!cancelled && result.restored) {
        setWorkspaceIds(computeWorkspaceIds(userId, userEmail))
        setCacheVersion((v) => v + 1)
        setRecoveryMessage(
          `Restored ${result.recoveredRows} records from ${result.sources.join(' and ')}.`,
        )
      }
      if (!cancelled) setReady(true)
    })()

    const firestore = getFirestoreDb()
    const unsubs: Array<() => void> = []

    unsubs.push(
      onSnapshot(
        doc(firestore, COL.users, userId),
        (snapshot) => {
          if (snapshot.exists()) {
            setUsers([{ id: snapshot.id, ...snapshot.data() } as never])
          }
        },
        (error) => console.warn('Firestore users profile listener:', error),
      ),
    )

    unsubs.push(
      onSnapshot(
        query(collection(firestore, COL.workspaces), where('ownerId', '==', userId)),
        (snapshot) => {
          setWorkspaces(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as never))
        },
        (error) => console.warn('Firestore workspaces listener:', error),
      ),
    )

    const normalizedEmail = userEmail.toLowerCase()

    function syncInvitesForUser(docs: WorkspaceInvite[]) {
      const normalized = normalizedEmail
      const forUser = docs.filter(
        (invite) => invite.email === normalized || invite.userId === userId,
      )
      setInvites(forUser)
    }

    unsubs.push(
      onSnapshot(
        query(collection(firestore, COL.members), where('userId', '==', userId)),
        (snapshot) => {
          setMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as never))
          setWorkspaceIds(computeWorkspaceIds(userId, userEmail))
        },
        (error) => console.warn('Firestore members listener:', error),
      ),
    )

    unsubs.push(
      onSnapshot(
        query(collection(firestore, COL.members), where('email', '==', userEmail.toLowerCase())),
        (snapshot) => {
          setMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as never))
          setWorkspaceIds(computeWorkspaceIds(userId, userEmail))
        },
        (error) => console.warn('Firestore members email listener:', error),
      ),
    )

    unsubs.push(
      onSnapshot(
        query(collection(firestore, COL.invites), where('email', '==', userEmail.toLowerCase())),
        (snapshot) => {
          syncInvitesForUser(
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WorkspaceInvite),
          )
        },
        (error) => console.warn('Firestore invites email listener:', error),
      ),
    )

    unsubs.push(
      onSnapshot(
        query(collection(firestore, COL.invites), where('userId', '==', userId)),
        (snapshot) => {
          syncInvitesForUser(
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WorkspaceInvite),
          )
        },
        (error) => console.warn('Firestore invites user listener:', error),
      ),
    )

    unsubs.push(
      onSnapshot(
        collection(firestore, COL.users),
        (snapshot) => {
          setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as never))
        },
        (error) => console.warn('Firestore all users listener:', error),
      ),
    )

    unsubs.push(
      onSnapshot(
        collection(firestore, COL.pendingPlans),
        (snapshot) => {
          const plans: Record<string, PlanId> = {}
          snapshot.docs.forEach((item) => {
            const data = item.data() as { email?: string; plan?: PlanId }
            if (data.email && data.plan) plans[data.email] = data.plan
          })
          setPendingPlans(plans)
        },
        (error) => console.warn('Firestore pending plans listener:', error),
      ),
    )

    unsubs.push(
      onSnapshot(
        query(collection(firestore, COL.notifications), where('userId', '==', userId)),
        (snapshot) => {
          setAppNotifications(
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as never),
          )
        },
        (error) => console.warn('Firestore notifications listener:', error),
      ),
    )

    return () => {
      cancelled = true
      unsubs.forEach((unsub) => unsub())
    }
  }, [userId, userEmail])

  const workspaceIdsKey = useMemo(
    () => [...workspaceIds].sort().join('|'),
    [workspaceIds],
  )

  useEffect(() => {
    if (!userId || !userEmail) return
    setWorkspaceIds(computeWorkspaceIds(userId, userEmail))
  }, [userId, userEmail, cacheVersion])

  useEffect(() => {
    if (!userId || !userEmail || !isFirebaseConfigured()) return
    if (workspaceIds.length === 0) return

    const firestore = getFirestoreDb()
    const unsubs: Array<() => void> = []

    workspaceIds.forEach((workspaceId) => {
      unsubs.push(
        onSnapshot(doc(firestore, COL.workspaces, workspaceId), (snapshot) => {
          if (!snapshot.exists()) return
          setWorkspaces([{ id: snapshot.id, ...snapshot.data() } as never])
        }),
      )

      unsubs.push(
        onSnapshot(
          query(collection(firestore, COL.members), where('workspaceId', '==', workspaceId)),
          (snapshot) => {
            applyWorkspaceMembersFromFirestore(
              workspaceId,
              snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as never),
            )
          },
        ),
      )

      unsubs.push(
        onSnapshot(
          query(collection(firestore, COL.teams), where('workspaceId', '==', workspaceId)),
          (snapshot) => {
            replaceTeamsForWorkspace(
              workspaceId,
              snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as never),
            )
          },
        ),
      )

      unsubs.push(
        onSnapshot(
          query(collection(firestore, COL.bases), where('workspaceId', '==', workspaceId)),
          (snapshot) => {
            const needsSync = mergeBasesForWorkspace(
              workspaceId,
              snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as never),
            )
            if (needsSync.length > 0) {
              void persistBases(needsSync)
            }
          },
        ),
      )
    })

    return () => unsubs.forEach((unsub) => unsub())
  }, [userId, userEmail, workspaceIdsKey])

  const value = useMemo(
    () => ({
      ready,
      online,
      localMode: !isFirebaseConfigured(),
      workspaceIds,
      cacheVersion,
      recoveryMessage,
      clearRecoveryMessage,
      tryRecoverData,
    }),
    [ready, online, workspaceIds, cacheVersion, recoveryMessage, clearRecoveryMessage, tryRecoverData],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}

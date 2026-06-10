import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import type { PlanId, Session } from '../types'
import {
  auth,
  initFirebasePersistence,
  isFirebaseConfigured,
  mapAuthError,
  waitForAuthReady,
} from '../lib/firebase'
import {
  getPendingPlanForEmail,
  clearPendingPlanForEmail,
  getUserById,
  getUsers,
  updateUserAvatar,
} from '../lib/storage'
import { hasAnyUsers, persistUser } from '../lib/firestoreSync'
import { isValidProfileEmoji, normalizeProfileEmoji } from '../lib/avatar'
import { linkMemberAccounts } from '../lib/members'
import { linkInvitesToUser } from '../lib/invites'
import { DataProvider } from './DataContext'
import { subscribeDataCache } from '../lib/dataStore'
import { getLocalSession, setLocalSession } from '../lib/localPersistence'
import { createId } from '../lib/id'

interface AuthContextValue {
  user: Session | null
  loading: boolean
  localMode: boolean
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  updateAvatar: (emoji: string | null) => { ok: boolean; error?: string }
  refreshProfile: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function buildSession(firebaseUser: FirebaseUser, profile?: {
  name?: string
  avatarEmoji?: string
  plan?: PlanId
}): Session {
  return {
    userId: firebaseUser.uid,
    email: firebaseUser.email?.toLowerCase() ?? '',
    name: profile?.name ?? firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User',
    avatarEmoji: profile?.avatarEmoji,
    plan: profile?.plan,
  }
}

function hydrateLocalSession(): Session | null {
  const session = getLocalSession()
  if (!session) return null
  const stored = getUserById(session.userId)
  return stored
    ? { ...session, name: stored.name, avatarEmoji: stored.avatarEmoji, plan: stored.plan }
    : session
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const localMode = !isFirebaseConfigured()

  const hydrateSession = useCallback((firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      setLocalSession(null)
      setUser(null)
      return
    }

    const profile = getUserById(firebaseUser.uid)
    const session = buildSession(firebaseUser, profile)
    setLocalSession(session)
    setUser(session)

    void linkMemberAccounts({
      id: session.userId,
      email: session.email,
      name: session.name,
    })
    linkInvitesToUser({ id: session.userId, email: session.email })
  }, [])

  useEffect(() => {
    if (localMode) {
      const session = hydrateLocalSession()
      if (session) {
        linkMemberAccounts({ id: session.userId, email: session.email, name: session.name })
        linkInvitesToUser({ id: session.userId, email: session.email })
        setUser(session)
      }
      setLoading(false)
      return
    }

    const cached = getLocalSession()
    if (cached) setUser(cached)

    let unsub = () => {}
    let cancelled = false
    let authInitialized = false

    unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!authInitialized) return
      hydrateSession(firebaseUser)
    })

    void (async () => {
      try {
        await initFirebasePersistence()
        await waitForAuthReady()
        if (cancelled) return
        authInitialized = true
        hydrateSession(auth.currentUser)
        setLoading(false)
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          authInitialized = true
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      unsub()
    }
  }, [hydrateSession, localMode])

  useEffect(() => {
    if (localMode) {
      return subscribeDataCache(() => {
        const session = getLocalSession()
        if (!session) return
        const hydrated = hydrateLocalSession()
        if (hydrated) setUser(hydrated)
      })
    }

    return subscribeDataCache(() => {
      if (auth.currentUser) hydrateSession(auth.currentUser)
    })
  }, [hydrateSession, localMode])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!name.trim()) return { ok: false, error: 'Name is required' }
    if (!trimmedEmail.includes('@')) return { ok: false, error: 'Enter a valid email' }
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters' }

    if (localMode) {
      if (getUsers().some((u) => u.email === trimmedEmail)) {
        return { ok: false, error: 'An account with this email already exists' }
      }

      const pendingPlan = getPendingPlanForEmail(trimmedEmail)
      const isFirstUser = getUsers().length === 0
      const plan: PlanId = pendingPlan ?? (isFirstUser ? 'og' : 'free')
      if (pendingPlan) clearPendingPlanForEmail(trimmedEmail)

      const newUser = {
        id: createId(),
        name: name.trim(),
        email: trimmedEmail,
        password,
        plan,
        planManaged: Boolean(pendingPlan),
      }

      await persistUser(newUser)
      linkInvitesToUser({ id: newUser.id, email: trimmedEmail })

      const session: Session = {
        userId: newUser.id,
        email: trimmedEmail,
        name: newUser.name,
        plan,
      }
      setLocalSession(session)
      setUser(session)
      return { ok: true }
    }

    if (!navigator.onLine) {
      return { ok: false, error: 'You are offline. Connect to the internet to create an account.' }
    }

    try {
      const pendingPlan = getPendingPlanForEmail(trimmedEmail)
      const isFirstUser = !(await hasAnyUsers())
      const plan: PlanId = pendingPlan ?? (isFirstUser ? 'og' : 'free')
      if (pendingPlan) clearPendingPlanForEmail(trimmedEmail)

      const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password)
      const profile = {
        id: credential.user.uid,
        name: name.trim(),
        email: trimmedEmail,
        plan,
        planManaged: Boolean(pendingPlan),
        createdAt: new Date().toISOString(),
      }

      await persistUser(profile)
      linkInvitesToUser({ id: credential.user.uid, email: trimmedEmail })

      const session = buildSession(credential.user, profile)
      setLocalSession(session)
      setUser(session)
      return { ok: true }
    } catch (error) {
      const code = (error as { code?: string }).code ?? ''
      return { ok: false, error: mapAuthError(code) }
    }
  }, [localMode])

  const login = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase()

    if (localMode) {
      const found = getUsers().find((u) => u.email === trimmedEmail && u.password === password)
      if (!found) return { ok: false, error: 'Invalid email or password' }

      linkMemberAccounts(found)
      linkInvitesToUser({ id: found.id, email: found.email })
      const session: Session = {
        userId: found.id,
        email: found.email,
        name: found.name,
        avatarEmoji: found.avatarEmoji,
        plan: found.plan,
      }
      setLocalSession(session)
      setUser(session)
      return { ok: true }
    }

    if (!navigator.onLine) {
      return { ok: false, error: 'You are offline. Connect to the internet to sign in with a new session.' }
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password)
      const profile = getUserById(credential.user.uid)
      const session = buildSession(credential.user, profile)
      setLocalSession(session)
      setUser(session)
      linkMemberAccounts({ id: session.userId, email: session.email, name: session.name })
      linkInvitesToUser({ id: session.userId, email: session.email })
      return { ok: true }
    } catch (error) {
      const code = (error as { code?: string }).code ?? ''
      return { ok: false, error: mapAuthError(code) }
    }
  }, [localMode])

  const updateAvatar = useCallback((emoji: string | null) => {
    if (!user) return { ok: false, error: 'Not signed in' }

    let normalized: string | null = null
    if (emoji) {
      normalized = normalizeProfileEmoji(emoji)
      if (!isValidProfileEmoji(normalized)) {
        return { ok: false, error: 'Enter a valid emoji' }
      }
    }

    const updated = updateUserAvatar(user.userId, normalized)
    if (!updated) return { ok: false, error: 'User not found' }

    const session: Session = {
      userId: updated.id,
      email: updated.email,
      name: updated.name,
      avatarEmoji: updated.avatarEmoji,
      plan: updated.plan,
    }
    setLocalSession(session)
    setUser(session)
    return { ok: true }
  }, [user, localMode])

  const refreshProfile = useCallback(() => {
    if (localMode) {
      const hydrated = hydrateLocalSession()
      if (hydrated) setUser(hydrated)
      return
    }
    if (!auth.currentUser) return
    const profile = getUserById(auth.currentUser.uid)
    const session = buildSession(auth.currentUser, profile)
    setLocalSession(session)
    setUser(session)
  }, [localMode])

  const logout = useCallback(async () => {
    setLocalSession(null)
    setUser(null)
    if (!localMode) await signOut(auth)
  }, [localMode])

  return (
    <AuthContext.Provider value={{ user, loading, localMode, signup, login, updateAvatar, refreshProfile, logout }}>
      <DataProvider userId={user?.userId ?? null} userEmail={user?.email ?? null}>
        {children}
      </DataProvider>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

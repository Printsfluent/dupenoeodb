import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  enableIndexedDbPersistence,
  enableNetwork,
  disableNetwork,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export function isLocalMode(): boolean {
  return !isFirebaseConfigured()
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  )
}

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Add VITE_FIREBASE_* variables to your environment.',
    )
  }
}

let app: FirebaseApp | undefined
let authInstance: Auth | undefined
let dbInstance: Firestore | undefined

function getFirebaseApp() {
  assertFirebaseConfigured()
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  }
  return app
}

export function getFirebaseAuth() {
  if (!authInstance) authInstance = getAuth(getFirebaseApp())
  return authInstance
}

export function getFirestoreDb() {
  if (!dbInstance) dbInstance = getFirestore(getFirebaseApp())
  return dbInstance
}

export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return Reflect.get(getFirebaseAuth(), prop, getFirebaseAuth())
  },
})

export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    return Reflect.get(getFirestoreDb(), prop, getFirestoreDb())
  },
})

let persistenceReady = false

export async function initFirebasePersistence() {
  if (persistenceReady) return
  assertFirebaseConfigured()

  await setPersistence(getFirebaseAuth(), browserLocalPersistence)

  try {
    await enableIndexedDbPersistence(getFirestoreDb())
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== 'failed-precondition' && code !== 'unimplemented') {
      console.warn('Firestore offline persistence unavailable:', error)
    }
  }

  persistenceReady = true
}

export async function setFirestoreNetworkEnabled(enabled: boolean) {
  if (enabled) await enableNetwork(getFirestoreDb())
  else await disableNetwork(getFirestoreDb())
}

export function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists'
    case 'auth/invalid-email':
      return 'Enter a valid email address'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.'
    case 'auth/network-request-failed':
      return 'You appear to be offline. Connect to the internet to sign in or sign up.'
    default:
      return 'Authentication failed. Please try again.'
  }
}

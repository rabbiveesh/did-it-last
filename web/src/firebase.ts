// The Firebase project that holds sign-in and the user's data. Created on first use, so
// tests and screens that never touch the cloud don't start Firebase.
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

// The web app's public config from the Firebase console (Project settings > Your apps).
// These values identify the project; they are not secrets. Access is guarded by
// firestore.rules at the repository root.
const config: FirebaseOptions = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
}

type Firebase = { app: FirebaseApp; auth: Auth; db: Firestore }
let firebase: Firebase | undefined

export const isFirebaseConfigured = () => Boolean(config.apiKey && config.projectId)

export function getFirebase(): Firebase {
  if (!firebase) {
    if (!isFirebaseConfigured()) throw new Error('The cloud project is not set up yet')
    const app = initializeApp(config)
    firebase = {
      app,
      auth: getAuth(app),
      // Keep a copy on the device so the list opens and saves offline, and syncs later.
      db: initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      }),
    }
  }
  return firebase
}

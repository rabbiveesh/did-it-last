// All persistence goes through this module. Signed in, the data lives in the user's
// Firestore collection; tests swap in unstorage's memory driver with `useDriver`.
import { createStorage, type Driver, type Storage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'

import { getFirebase } from '@/firebase'
import firestoreDriver from './firestore'

let storage: Storage = createStorage({ driver: memoryDriver() })

export function getStorage(): Storage {
  return storage
}

/** Swap the storage backend, e.g. the memory driver in tests. */
export function useDriver(driver?: Driver): void {
  storage = createStorage(driver ? { driver } : {})
}

/** Point storage at one signed-in user's own data in the cloud. */
export function useAccountStorage(uid: string): void {
  useDriver(firestoreDriver({ db: getFirebase().db, uid }))
}

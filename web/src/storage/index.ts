// All persistence goes through this module. Signed in, the user's data lives in their
// Firestore collection; tests swap in unstorage's memory driver with `useDriver`.
// Facts about this browser alone (its device id) stay in localStorage and never sync.
import { createStorage, type Driver, type Storage } from 'unstorage'
import localStorageDriver from 'unstorage/drivers/localstorage'
import memoryDriver from 'unstorage/drivers/memory'

import { getFirebase } from '@/firebase'
import firestoreDriver from './firestore'

let storage: Storage = createStorage({ driver: memoryDriver() })
const deviceStorage: Storage = createStorage({
  driver: localStorageDriver({ base: 'did-it-last' }),
})

export function getStorage(): Storage {
  return storage
}

export function getDeviceStorage(): Storage {
  return deviceStorage
}

/** Swap the storage backend, e.g. the memory driver in tests. */
export function useDriver(driver?: Driver): void {
  storage = createStorage(driver ? { driver } : {})
}

/** Point storage at one signed-in user's own data in the cloud. */
export function useAccountStorage(uid: string): void {
  useDriver(firestoreDriver({ db: getFirebase().db, uid }))
}

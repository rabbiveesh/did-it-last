// All persistence goes through this module. Today it is unstorage's localStorage driver;
// moving to a backend later means passing a different driver to `useDriver`.
import { createStorage, type Driver, type Storage } from 'unstorage'
import localStorageDriver from 'unstorage/drivers/localstorage'

let storage: Storage = createStorage({ driver: localStorageDriver({ base: 'did-it-last' }) })

export function getStorage(): Storage {
  return storage
}

/** Swap the storage backend, e.g. an HTTP driver for a server, or the memory driver in tests. */
export function useDriver(driver?: Driver): void {
  storage = createStorage(driver ? { driver } : {})
}

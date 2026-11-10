// An unstorage driver for Cloud Firestore (the `firebase/firestore` web SDK), shaped like
// unstorage's own drivers so it can be offered upstream. Nothing here knows about this app.
//
// Each key is one document in the given collection: `{ key, value, modifiedAt }`. Values
// are unstorage's serialized strings, as in its mongodb driver. The document id is the key,
// escaped so that any unstorage key makes a valid id; the key itself is kept in a field so
// prefix listings are a single range query.
//
// While `watch` is on, the driver holds the whole collection from its listener, and reads
// are answered from that copy: the listener's one read per document is all it costs.
import { defineDriver } from 'unstorage'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type Timestamp,
} from 'firebase/firestore'

export interface FirestoreDriverOptions {
  /** A Firestore instance from `firebase/firestore`. */
  firestore: Firestore
  /** Path of the collection that holds the entries, e.g. `users/<uid>/entries`. */
  collection: string
}

const DRIVER_NAME = 'firebase-firestore'
/** Firestore's limits: values in an `in` filter, and writes in a batch. */
const IN_LIMIT = 30
const BATCH_LIMIT = 500

/**
 * A valid document id for any key: no `/`, never `.` or `..`, never `__name__`.
 * Escaping `%`, `.` and `_` as well as what encodeURIComponent escapes keeps it reversible.
 */
export function escapeKey(key: string): string {
  return encodeURIComponent(key).replace(
    /[._]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, n) =>
    items.slice(n * size, (n + 1) * size),
  )
}

export default defineDriver((opts: FirestoreDriverOptions) => {
  if (!opts?.firestore) throw new Error(`[unstorage] [${DRIVER_NAME}] Missing option \`firestore\``)
  if (!opts.collection)
    throw new Error(`[unstorage] [${DRIVER_NAME}] Missing option \`collection\``)

  const entries: CollectionReference = collection(opts.firestore, opts.collection)
  const entry = (key: string) => doc(entries, escapeKey(key))

  /** Every entry whose key starts with `base`, or all of them. */
  function underBase(base?: string): Query {
    return base
      ? query(entries, where('key', '>=', base), where('key', '<', `${base}\uffff`))
      : entries
  }

  async function deleteAll(base?: string) {
    const docs = (await getDocs(underBase(base))).docs
    for (const group of chunks(docs, BATCH_LIMIT)) {
      const batch = writeBatch(opts.firestore)
      for (const d of group) batch.delete(d.ref)
      await batch.commit()
    }
  }

  let unsubscribe: (() => void) | undefined
  /** The whole collection, kept current by the listener while watching. */
  let live: Map<string, DocumentSnapshot> | undefined

  function stopWatching() {
    unsubscribe?.()
    unsubscribe = undefined
    live = undefined
  }

  /** The live copy's entries whose key starts with `base`, or all of them. */
  const liveUnder = (docs: Map<string, DocumentSnapshot>, base?: string) =>
    [...docs.keys()].filter((key) => !base || key.startsWith(base))

  return {
    name: DRIVER_NAME,
    options: opts,
    getInstance: () => entries,
    async hasItem(key) {
      if (live) return live.has(key)
      return (await getDoc(entry(key))).exists()
    },
    async getItem(key) {
      if (live) return (live.get(key)?.get('value') as string | undefined) ?? null
      const snapshot = await getDoc(entry(key))
      return snapshot.exists() ? (snapshot.get('value') as string) : null
    },
    async getItems(items) {
      const keys = items.map((item) => item.key)
      if (live) {
        const docs = live
        return keys.map((key) => ({ key, value: docs.get(key)?.get('value') ?? null }))
      }
      const values = new Map<string, string>()
      for (const group of chunks(keys, IN_LIMIT)) {
        const found = await getDocs(query(entries, where('key', 'in', group)))
        for (const d of found.docs) values.set(d.get('key') as string, d.get('value') as string)
      }
      return keys.map((key) => ({ key, value: values.get(key) ?? null }))
    },
    async setItem(key, value) {
      await setDoc(entry(key), { key, value, modifiedAt: serverTimestamp() })
    },
    // Written together: they land together or not at all (up to Firestore's batch limit).
    async setItems(items) {
      for (const group of chunks(items, BATCH_LIMIT)) {
        const batch = writeBatch(opts.firestore)
        for (const { key, value } of group) {
          batch.set(entry(key), { key, value, modifiedAt: serverTimestamp() })
        }
        await batch.commit()
      }
    },
    async removeItem(key) {
      await deleteDoc(entry(key))
    },
    async getKeys(base) {
      if (live) return liveUnder(live, base)
      return (await getDocs(underBase(base))).docs.map((d) => d.get('key') as string)
    },
    async getMeta(key) {
      const snapshot = live?.get(key) ?? (await getDoc(entry(key)))
      // A write not yet confirmed by the server has only an estimated time.
      const modified = snapshot.get('modifiedAt', { serverTimestamps: 'estimate' }) as
        Timestamp | undefined
      return modified ? { mtime: modified.toDate() } : {}
    },
    async clear(base) {
      await deleteAll(base)
    },
    async dispose() {
      stopWatching()
    },
    // Reports changes made after watching starts, by this client or any other, and resolves
    // once the listener has the whole collection. A local write shows up twice (pending, then
    // confirmed with its server time); the value is the same, so it is reported once.
    async watch(callback) {
      stopWatching()
      const docs = new Map<string, DocumentSnapshot>()
      let first = true
      await new Promise<void>((resolve, reject) => {
        unsubscribe = onSnapshot(
          entries,
          (snapshot) => {
            for (const change of snapshot.docChanges()) {
              const key = change.doc.get('key') as string
              const before = docs.get(key)?.get('value')
              if (change.type === 'removed') {
                docs.delete(key)
                if (!first) callback('remove', key)
              } else {
                docs.set(key, change.doc)
                if (!first && before !== change.doc.get('value')) callback('update', key)
              }
            }
            if (first) {
              first = false
              live = docs
              resolve()
            }
          },
          (error) => {
            // Reads go back to asking Firestore directly.
            stopWatching()
            reject(error)
          },
        )
      })
      return stopWatching
    },
  }
})

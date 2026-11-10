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
// With `incremental`, watching starts from what Firestore's local cache already holds and
// asks the server only for entries written since, so each document is fetched once per
// device instead of on every start.
import { defineDriver, type WatchCallback } from 'unstorage'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
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
} from 'firebase/firestore'

export interface FirestoreDriverOptions {
  /** A Firestore instance from `firebase/firestore`. */
  firestore: Firestore
  /** Path of the collection that holds the entries, e.g. `users/<uid>/entries`. */
  collection: string
  /**
   * Start `watch` from Firestore's local cache and fetch from the server only entries written
   * since the newest cached one. Fits collections that are only added to: an entry another
   * client removes is not noticed while it is still in this client's cache. Use with a
   * persistent local cache large enough to keep the whole collection.
   */
  incremental?: boolean
}

/** Commits become visible in about their timestamp order; re-read a little to be sure. */
const INCREMENTAL_OVERLAP_MS = 60_000

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

  type Entry = { value: unknown; modifiedAt?: Timestamp }
  const fromDoc = (d: DocumentSnapshot): Entry => ({
    value: d.get('value'),
    // A write not yet confirmed by the server has only an estimated time.
    modifiedAt: d.get('modifiedAt', { serverTimestamps: 'estimate' }) as Timestamp | undefined,
  })

  let unsubscribe: (() => void) | undefined
  /** While watching, the whole collection: from the listener, plus this client's writes. */
  let live: Map<string, Entry> | undefined
  let notify: WatchCallback | undefined

  function stopWatching() {
    unsubscribe?.()
    unsubscribe = undefined
    live = undefined
    notify = undefined
  }

  /** Records this client's own write in the held copy, and reports it once. */
  function heldWrite(key: string, value: unknown) {
    if (!live) return
    live.set(key, { value })
    notify?.('update', key)
  }

  function heldRemove(key: string) {
    if (live?.delete(key)) notify?.('remove', key)
  }

  /** What the server is asked for when watching starts, given what is already held. */
  function watchedQuery(held: Map<string, Entry>): Query {
    const newest = Math.max(0, ...[...held.values()].map((e) => e.modifiedAt?.toMillis() ?? 0))
    if (!opts.incremental || newest === 0) return entries
    const since = Timestamp.fromMillis(newest - INCREMENTAL_OVERLAP_MS)
    return query(entries, where('modifiedAt', '>', since))
  }

  return {
    name: DRIVER_NAME,
    options: opts,
    getInstance: () => entries,
    async hasItem(key) {
      if (live) return live.has(key)
      return (await getDoc(entry(key))).exists()
    },
    async getItem(key) {
      if (live) return (live.get(key)?.value as string | undefined) ?? null
      const snapshot = await getDoc(entry(key))
      return snapshot.exists() ? (snapshot.get('value') as string) : null
    },
    async getItems(items) {
      const keys = items.map((item) => item.key)
      if (live) {
        const held = live
        return keys.map((key) => ({ key, value: held.get(key)?.value ?? null }))
      }
      const values = new Map<string, string>()
      for (const group of chunks(keys, IN_LIMIT)) {
        const found = await getDocs(query(entries, where('key', 'in', group)))
        for (const d of found.docs) values.set(d.get('key') as string, d.get('value') as string)
      }
      return keys.map((key) => ({ key, value: values.get(key) ?? null }))
    },
    async setItem(key, value) {
      heldWrite(key, value)
      await setDoc(entry(key), { key, value, modifiedAt: serverTimestamp() })
    },
    // Written together: they land together or not at all (up to Firestore's batch limit).
    async setItems(items) {
      for (const { key, value } of items) heldWrite(key, value)
      for (const group of chunks(items, BATCH_LIMIT)) {
        const batch = writeBatch(opts.firestore)
        for (const { key, value } of group) {
          batch.set(entry(key), { key, value, modifiedAt: serverTimestamp() })
        }
        await batch.commit()
      }
    },
    async removeItem(key) {
      heldRemove(key)
      await deleteDoc(entry(key))
    },
    async getKeys(base) {
      if (live) return [...live.keys()].filter((key) => !base || key.startsWith(base))
      return (await getDocs(underBase(base))).docs.map((d) => d.get('key') as string)
    },
    async getMeta(key) {
      const modified = live
        ? live.get(key)?.modifiedAt
        : fromDoc(await getDoc(entry(key))).modifiedAt
      return modified ? { mtime: modified.toDate() } : {}
    },
    async clear(base) {
      // Deleting from a Map while iterating it is safe: each key is still visited once.
      for (const key of live?.keys() ?? []) if (!base || key.startsWith(base)) heldRemove(key)
      await deleteAll(base)
    },
    async dispose() {
      stopWatching()
    },
    // Reports changes made after watching starts, by this client or any other, and resolves
    // once the whole collection is held. Each change is reported once: the listener's echoes
    // of a write (pending, then confirmed with its server time) carry no new value.
    async watch(callback) {
      stopWatching()
      const held = new Map<string, Entry>()
      if (opts.incremental) {
        // Free: no server reads. Fails without a cache, then everything is fetched.
        const cached = await getDocsFromCache(entries).catch(() => undefined)
        for (const d of cached?.docs ?? []) held.set(d.get('key') as string, fromDoc(d))
      }
      let first = true
      await new Promise<void>((resolve, reject) => {
        unsubscribe = onSnapshot(
          watchedQuery(held),
          (snapshot) => {
            for (const change of snapshot.docChanges()) {
              const key = change.doc.get('key') as string
              const before = held.get(key)?.value
              if (change.type === 'removed') {
                // Only a deletion takes an entry out: written times never go backwards.
                if (held.delete(key) && !first) callback('remove', key)
              } else {
                held.set(key, fromDoc(change.doc))
                if (!first && before !== change.doc.get('value')) callback('update', key)
              }
            }
            if (first) {
              first = false
              live = held
              notify = callback
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

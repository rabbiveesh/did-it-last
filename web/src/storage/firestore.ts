// An unstorage driver that keeps each key as one Firestore document in the signed-in
// user's own collection, `users/{uid}/entries/{key}`. Values are unstorage's serialized
// strings, so the driver stays a plain key-value store like the others.
import { defineDriver } from 'unstorage'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

export type FirestoreDriverOptions = { db: Firestore; uid: string }

export default defineDriver((opts: FirestoreDriverOptions) => {
  const entries = collection(opts.db, 'users', opts.uid, 'entries')
  const entry = (key: string) => doc(entries, key)

  async function allEntries() {
    return (await getDocs(entries)).docs
  }

  return {
    name: 'firestore',
    options: opts,
    async hasItem(key) {
      return (await getDoc(entry(key))).exists()
    },
    async getItem(key) {
      const snapshot = await getDoc(entry(key))
      return snapshot.exists() ? (snapshot.get('value') as string) : null
    },
    // One query for a batch instead of a read per key.
    async getItems(items) {
      const values = new Map((await allEntries()).map((d) => [d.id, d.get('value') as string]))
      return items.map(({ key }) => ({ key, value: values.get(key) ?? null }))
    },
    async setItem(key, value) {
      await setDoc(entry(key), { value })
    },
    // One batch, so the entries written together land together or not at all.
    async setItems(items) {
      const batch = writeBatch(opts.db)
      for (const { key, value } of items) batch.set(entry(key), { value })
      await batch.commit()
    },
    async removeItem(key) {
      await deleteDoc(entry(key))
    },
    async getKeys() {
      return (await allEntries()).map((d) => d.id)
    },
    async clear(base) {
      const batch = writeBatch(opts.db)
      for (const d of await allEntries()) {
        if (!base || d.id.startsWith(`${base}:`)) batch.delete(d.ref)
      }
      await batch.commit()
    },
  }
})

// Reads and appends the change log through the storage module. Each change is its own
// entry (`changes:<id>`) and is never rewritten, so devices syncing later can't clobber
// each other: they only add entries.
import type { Unwatch } from 'unstorage'

import type { ItemChange } from '@/core'
import { getDeviceStorage, getStorage } from '@/storage'
import { migrate } from './migrations'
import { SCHEMA_VERSION, type StoredChange } from './schema'

const CHANGES = 'changes'
const DEVICE_ID = 'device-id'

/** Every change saved so far, in the current format. */
export async function loadChanges(): Promise<ItemChange[]> {
  const storage = getStorage()
  const keys = await storage.getKeys(CHANGES)
  return (await storage.getItems(keys)).map((entry) => migrate(entry.value))
}

/**
 * Calls `onAdded` with each change saved from now on, from this device or another one.
 * Returns a function that stops watching.
 */
export async function watchChanges(onAdded: (change: ItemChange) => void): Promise<Unwatch> {
  const storage = getStorage()
  return storage.watch(async (event, key) => {
    if (event !== 'update' || !key.startsWith(`${CHANGES}:`)) return
    const stored = await storage.getItem(key)
    if (stored != null) onAdded(migrate(stored))
  })
}

export async function appendChanges(changes: ItemChange[]): Promise<void> {
  await getStorage().setItems(
    changes.map((change) => ({
      key: `${CHANGES}:${change.id}`,
      value: JSON.parse(JSON.stringify({ v: SCHEMA_VERSION, change } satisfies StoredChange)),
    })),
  )
}

/** This browser's own id, which marks the changes made here. Made on first use. */
export async function deviceId(): Promise<string> {
  const storage = getDeviceStorage()
  const saved = await storage.getItem<string>(DEVICE_ID)
  if (saved) return saved
  const id = crypto.randomUUID()
  await storage.setItem(DEVICE_ID, id)
  return id
}

// Reads and writes the app's data through the storage module. Each item is its own
// entry (`items:<id>`), so edits from two devices only clash on the same item, and the
// schema version lives in `meta`.
import type { Item } from '@/core'
import { getStorage } from '@/storage'
import { migrate } from './migrations'
import { SCHEMA_VERSION, type AppData } from './schema'

const META = 'meta'
const ITEMS = 'items'
const itemKey = (id: string) => `${ITEMS}:${id}`

type Meta = { version: number }

export function emptyData(): AppData {
  return { version: SCHEMA_VERSION, items: [] }
}

/** Loads saved data, upgrading it to the current schema. A first run starts empty. */
export async function loadAppData(): Promise<AppData> {
  const storage = getStorage()
  const meta = await storage.getItem<Meta>(META)
  if (meta == null) {
    await storage.setItem(META, { version: SCHEMA_VERSION })
    return emptyData()
  }
  const keys = await storage.getKeys(ITEMS)
  const items = (await storage.getItems(keys)).map((entry) => entry.value)
  const data = migrate({ ...meta, items })
  if (meta.version !== data.version) await saveAllAppData(data)
  return data
}

export async function saveItem(item: Item): Promise<void> {
  await getStorage().setItem(itemKey(item.id), JSON.parse(JSON.stringify(item)))
}

export async function removeItem(id: string): Promise<void> {
  await getStorage().removeItem(itemKey(id))
}

/** Rewrites everything, e.g. after a schema upgrade. */
async function saveAllAppData(data: AppData): Promise<void> {
  const storage = getStorage()
  await storage.clear(ITEMS)
  await Promise.all(data.items.map(saveItem))
  await storage.setItem(META, { version: data.version })
}

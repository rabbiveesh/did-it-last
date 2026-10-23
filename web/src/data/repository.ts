import { getStorage } from '@/storage'
import { migrate } from './migrations'
import { SCHEMA_VERSION, type AppData } from './schema'

const KEY = 'app-data'

export function emptyData(): AppData {
  return { version: SCHEMA_VERSION, items: [] }
}

/** Loads saved data, or null on first run. */
export async function loadAppData(): Promise<AppData | null> {
  const raw = await getStorage().getItem(KEY)
  return raw == null ? null : migrate(raw)
}

export async function saveAppData(data: AppData): Promise<void> {
  await getStorage().setItem(KEY, JSON.parse(JSON.stringify(data)))
}

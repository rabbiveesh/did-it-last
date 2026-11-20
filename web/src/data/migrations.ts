import type { ItemChange } from '@/core'
import { SCHEMA_VERSION, type StoredChange } from './schema'

/** One step per version: migrations[n] upgrades a stored change from version n to n + 1. */
const migrations: Record<number, (change: Record<string, unknown>) => Record<string, unknown>> = {
  // None yet: v1 is the first version.
}

export class UnsupportedDataError extends Error {}

/** Upgrades one stored change of any known version to the current format. */
export function migrate(raw: unknown): ItemChange {
  const stored = raw as Partial<StoredChange> | null
  if (typeof stored?.v !== 'number' || typeof stored.change !== 'object') {
    throw new UnsupportedDataError('A saved change has no version number')
  }
  if (stored.v > SCHEMA_VERSION) {
    throw new UnsupportedDataError(
      `Some changes were saved by a newer version of the app (v${stored.v}); please update the app`,
    )
  }
  let change = stored.change as unknown as Record<string, unknown>
  for (let v = stored.v; v < SCHEMA_VERSION; v++) {
    const step = migrations[v]
    if (!step) throw new UnsupportedDataError(`No migration from v${v}`)
    change = step(change)
  }
  return change as unknown as ItemChange
}

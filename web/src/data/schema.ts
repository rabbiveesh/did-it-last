// The shape of everything the app stores. Bump SCHEMA_VERSION and add a step to
// migrations.ts whenever it changes.
import type { Item } from '@/core'

export const SCHEMA_VERSION = 1

/** Dates are local calendar days, `YYYY-MM-DD`. */
export type IsoDate = string

export type AppData = {
  version: number
  items: Item[]
}

// The shape of what the app stores. The list is never stored as such: it is the change
// log, and the Rust core folds it into items. Bump SCHEMA_VERSION and add a step to
// migrations.ts whenever the stored change format changes.
import type { ItemChange } from '@/core'

export const SCHEMA_VERSION = 1

/** Dates are local calendar days, `YYYY-MM-DD`. */
export type IsoDate = string

/** One change as stored: its format version, so any version of the app can read it. */
export type StoredChange = { v: number; change: ItemChange }

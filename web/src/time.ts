// The user's local calendar day: purchase dates are days on the phone's clock.
import { formatISO } from 'date-fns'

import type { IsoDate } from '@/data/schema'

/** `YYYY-MM-DD` in local time. */
export function localDate(at: Date = new Date()): IsoDate {
  return formatISO(at, { representation: 'date' })
}

// The user's local calendar day: purchase dates are days on the phone's clock.
import type { IsoDate } from '@/data/schema'

/** `YYYY-MM-DD` in local time (the en-CA locale formats dates that way). */
export function localDate(at: Date = new Date()): IsoDate {
  return at.toLocaleDateString('en-CA')
}

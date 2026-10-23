// How the list words an item's lifespan.
import type { ItemRow } from '@/core'

const days = new Intl.NumberFormat('en', { style: 'unit', unit: 'day', unitDisplay: 'long' })

export function lastedLabel(row: ItemRow): string {
  const n = days.format(row.daysLasted)
  return row.stillGoing ? `${n} so far` : `Lasted ${n}`
}

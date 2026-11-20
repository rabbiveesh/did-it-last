// How a conflict is worded for the user.
import type { ItemEdit, ItemField } from '@/core'

export const fieldLabel: Record<ItemField, string> = {
  name: 'Name',
  boughtOn: 'Bought on',
  endedOn: 'Done on',
}

export function editLabel(edit: ItemEdit): string {
  return edit.value ?? 'Still going'
}

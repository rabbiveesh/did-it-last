import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  itemEdits,
  itemRows,
  ledger,
  recordItemEdits,
  type Item,
  type ItemChange,
  type ItemOp,
} from '@/core'
import { appendChanges, deviceId, loadChanges } from '@/data/repository'
import type { IsoDate } from '@/data/schema'
import { localDate } from '@/time'

export const useItemsStore = defineStore('items', () => {
  /** The change log; everything else is worked out from it. */
  const changes = ref<ItemChange[]>([])
  const device = ref('')
  let lastAt = 0
  const loaded = ref(false)
  const loadError = ref<string | null>(null)
  const saveError = ref<string | null>(null)
  // The current day; refreshed whenever the list opens.
  const today = ref<IsoDate>(localDate())

  const current = computed(() => ledger(changes.value))
  const rows = computed(() => itemRows(current.value.items, today.value))
  const conflicts = computed(() => current.value.conflicts)

  async function load() {
    loaded.value = false
    loadError.value = null
    try {
      device.value = await deviceId()
      changes.value = await loadChanges()
      loaded.value = true
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
  }

  /** Forgets the list, e.g. after signing out. */
  function clear() {
    changes.value = []
    loaded.value = false
  }

  // The list changes at once; the save finishes in the background. Offline, the cloud
  // only confirms a save once the phone is back online.
  function apply(itemId: string, edits: ItemOp[]) {
    if (edits.length === 0) return
    // Strictly increasing, so two edits in the same millisecond still get distinct ids.
    lastAt = Math.max(Date.now(), lastAt + 1)
    const stamp = { at: lastAt, device: device.value }
    const added = recordItemEdits(changes.value, itemId, edits, stamp)
    changes.value = [...changes.value, ...added]
    appendChanges(added).then(
      () => (saveError.value = null),
      (e: unknown) => (saveError.value = e instanceof Error ? e.message : String(e)),
    )
  }

  const refreshToday = () => (today.value = localDate())
  const find = (id: string) => current.value.items.find((i) => i.id === id)
  const conflictsFor = (id: string) => conflicts.value.filter((c) => c.itemId === id)

  /** Adds a new item, or records what changed in an existing one. */
  const save = (item: Item) => apply(item.id, itemEdits(find(item.id), item))
  const remove = (id: string) => apply(id, [{ op: 'deleted', value: true }])
  /** Settles a conflict by recording the chosen value as the newest edit. */
  const choose = (itemId: string, op: ItemOp) => apply(itemId, [op])

  return {
    changes,
    loaded,
    loadError,
    saveError,
    today,
    rows,
    conflicts,
    load,
    clear,
    refreshToday,
    find,
    conflictsFor,
    save,
    remove,
    choose,
  }
})

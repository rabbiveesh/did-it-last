import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { itemRows, type Item } from '@/core'
import { emptyData, loadAppData, removeItem, saveItem } from '@/data/repository'
import type { AppData, IsoDate } from '@/data/schema'
import { localDate } from '@/time'

export const useItemsStore = defineStore('items', () => {
  const data = ref<AppData>(emptyData())
  const loaded = ref(false)
  const loadError = ref<string | null>(null)
  const saveError = ref<string | null>(null)
  // The current day; refreshed whenever the list opens.
  const today = ref<IsoDate>(localDate())

  const rows = computed(() => itemRows(data.value.items, today.value))

  async function load() {
    loaded.value = false
    loadError.value = null
    try {
      data.value = await loadAppData()
      loaded.value = true
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
  }

  /** Forgets the list, e.g. after signing out. */
  function clear() {
    data.value = emptyData()
    loaded.value = false
  }

  // The list changes at once; the save finishes in the background. Offline, the cloud
  // only confirms a save once the phone is back online.
  function persist(save: Promise<void>) {
    save.then(
      () => (saveError.value = null),
      (e: unknown) => (saveError.value = e instanceof Error ? e.message : String(e)),
    )
  }

  const refreshToday = () => (today.value = localDate())
  const find = (id: string) => data.value.items.find((i) => i.id === id)

  /** Adds a new item, or replaces the one with the same id. */
  function save(item: Item) {
    const at = data.value.items.findIndex((i) => i.id === item.id)
    if (at >= 0) data.value.items[at] = item
    else data.value.items.push(item)
    persist(saveItem(item))
  }

  function remove(id: string) {
    data.value.items = data.value.items.filter((i) => i.id !== id)
    persist(removeItem(id))
  }

  return {
    data,
    loaded,
    loadError,
    saveError,
    today,
    rows,
    load,
    clear,
    refreshToday,
    find,
    save,
    remove,
  }
})

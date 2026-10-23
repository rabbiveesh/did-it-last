import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { itemRows, type Item } from '@/core'
import { emptyData, loadAppData, saveAppData } from '@/data/repository'
import type { AppData, IsoDate } from '@/data/schema'
import { localDate } from '@/time'

export const useItemsStore = defineStore('items', () => {
  const data = ref<AppData>(emptyData())
  const loaded = ref(false)
  const loadError = ref<string | null>(null)
  // The current day; refreshed whenever the list opens.
  const today = ref<IsoDate>(localDate())

  const rows = computed(() => itemRows(data.value.items, today.value))

  async function load() {
    try {
      data.value = (await loadAppData()) ?? emptyData()
      loaded.value = true
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function update(change: (d: AppData) => void) {
    change(data.value)
    await saveAppData(data.value)
  }

  const refreshToday = () => (today.value = localDate())
  const find = (id: string) => data.value.items.find((i) => i.id === id)

  /** Adds a new item, or replaces the saved one with the same id. */
  function save(item: Item) {
    return update((d) => {
      const at = d.items.findIndex((i) => i.id === item.id)
      if (at >= 0) d.items[at] = item
      else d.items.push(item)
    })
  }

  const remove = (id: string) => update((d) => (d.items = d.items.filter((i) => i.id !== id)))

  return { data, loaded, loadError, today, rows, load, refreshToday, find, save, remove }
})

import { beforeEach, describe, expect, it } from 'vitest'
import memoryDriver from 'unstorage/drivers/memory'

import { getStorage, useDriver } from '@/storage'
import { loadAppData, removeItem, saveItem } from '../repository'

const kettle = { id: 'a', name: 'Kettle', boughtOn: '2026-10-01' }
const shoes = { id: 'b', name: 'Shoes', boughtOn: '2025-03-01', endedOn: '2026-03-01' }

describe('saving items', () => {
  beforeEach(() => useDriver(memoryDriver()))

  it('starts with an empty list the first time', async () => {
    expect(await loadAppData()).toEqual({ version: 1, items: [] })
  })

  it('brings back every saved item', async () => {
    await loadAppData()
    await saveItem(kettle)
    await saveItem(shoes)
    const { items } = await loadAppData()
    expect(items).toEqual(expect.arrayContaining([kettle, shoes]))
    expect(items).toHaveLength(2)
  })

  it('keeps each item separately, so changing one never rewrites the others', async () => {
    await loadAppData()
    await saveItem(kettle)
    await saveItem(shoes)
    await saveItem({ ...kettle, endedOn: '2026-10-20' })
    await removeItem(shoes.id)
    expect(await getStorage().getKeys('items')).toEqual(['items:a'])
    expect((await loadAppData()).items).toEqual([{ ...kettle, endedOn: '2026-10-20' }])
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import memoryDriver from 'unstorage/drivers/memory'
import type { Driver, WatchCallback } from 'unstorage'

import { recordItemEdits, type ItemChange } from '@/core'
import { useDriver } from '@/storage'
import { appendChanges, watchChanges } from '../repository'

// Memory storage that reports writes when told to, standing in for the cloud telling us
// another device saved something.
let notify: WatchCallback = () => {}
const watchedMemory = (): Driver => ({
  ...memoryDriver(),
  watch(callback) {
    notify = callback
    return () => {}
  },
})

describe('following the change log', () => {
  beforeEach(() => useDriver(watchedMemory()))

  it('hears about changes another device saved', async () => {
    const heard: ItemChange[] = []
    const unwatch = await watchChanges((c) => heard.push(c))
    const added = recordItemEdits(
      [],
      'k',
      [{ op: 'set', value: { field: 'name', value: 'Kettle' } }],
      { at: 1, device: 'laptop' },
    )
    await appendChanges(added)
    notify('update', `changes:${added[0]!.id}`)
    notify('update', 'something-else')
    await expect.poll(() => heard).toEqual(added)
    await unwatch()
  })
})

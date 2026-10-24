import { beforeEach, describe, expect, it } from 'vitest'
import memoryDriver from 'unstorage/drivers/memory'

import { recordItemEdits, type ItemChange } from '@/core'
import { getStorage, useDriver } from '@/storage'
import { appendChanges, deviceId, loadChanges } from '../repository'

const stamp = { at: 1, device: 'phone' }
const added = (): ItemChange[] =>
  recordItemEdits(
    [],
    'k',
    [
      { op: 'set', value: { field: 'name', value: 'Kettle' } },
      { op: 'set', value: { field: 'boughtOn', value: '2026-10-01' } },
    ],
    stamp,
  )

describe('the change log', () => {
  beforeEach(() => useDriver(memoryDriver()))

  it('starts empty the first time', async () => {
    expect(await loadChanges()).toEqual([])
  })

  it('brings back every saved change', async () => {
    await appendChanges(added())
    expect(await loadChanges()).toEqual(expect.arrayContaining(added()))
  })

  it('only ever adds entries, one per change', async () => {
    await appendChanges(added())
    const later = recordItemEdits(added(), 'k', [{ op: 'deleted', value: true }], {
      at: 2,
      device: 'laptop',
    })
    await appendChanges(later)
    expect(await getStorage().getKeys('changes')).toHaveLength(3)
  })

  it('refuses changes saved by a newer version of the app instead of guessing', async () => {
    await getStorage().setItem('changes:x', { v: 99, change: {} })
    await expect(loadChanges()).rejects.toThrow(/newer version/)
  })

  it('keeps the same device id for this browser', async () => {
    expect(await deviceId()).toBe(await deviceId())
  })
})

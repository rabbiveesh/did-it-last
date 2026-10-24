import { describe, expect, it } from 'vitest'

import { migrate, UnsupportedDataError } from '../migrations'
import { SCHEMA_VERSION } from '../schema'

const change = {
  id: 'phone.1.0',
  recordId: 'k',
  parents: [],
  at: 1,
  device: 'phone',
  edit: { op: 'set', value: { field: 'name', value: 'Kettle' } },
}

describe('saved changes', () => {
  it('loads a change saved by the current version unchanged', () => {
    expect(migrate({ v: SCHEMA_VERSION, change: structuredClone(change) })).toEqual(change)
  })

  it('refuses a change from a newer version of the app instead of guessing', () => {
    expect(() => migrate({ v: SCHEMA_VERSION + 1, change })).toThrow(UnsupportedDataError)
  })

  it('refuses a change with no version number', () => {
    expect(() => migrate({ change })).toThrow(UnsupportedDataError)
  })
})

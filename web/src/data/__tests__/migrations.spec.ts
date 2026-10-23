import { describe, expect, it } from 'vitest'

import { migrate, UnsupportedDataError } from '../migrations'
import { emptyData } from '../repository'
import { SCHEMA_VERSION } from '../schema'

describe('saved data', () => {
  it('loads data saved by the current version unchanged', () => {
    const saved = {
      ...emptyData(),
      items: [{ id: 'a', name: 'Kettle', boughtOn: '2026-10-01' }],
    }
    expect(migrate(structuredClone(saved))).toEqual(saved)
  })

  it('refuses data from a newer version of the app instead of guessing', () => {
    expect(() => migrate({ version: SCHEMA_VERSION + 1 })).toThrow(UnsupportedDataError)
  })

  it('refuses data with no version number', () => {
    expect(() => migrate({})).toThrow(UnsupportedDataError)
  })
})

// @vitest-environment node
// The Firestore driver against the real Firestore, run in the local emulator:
//   npm run test:emulator
// Skipped by a plain `vitest run`, which has no emulator to talk to.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore, terminate } from 'firebase/firestore'
import { createStorage, type Storage } from 'unstorage'

import firestoreDriver, { escapeKey } from '../firestore'

const host = process.env.FIRESTORE_EMULATOR_HOST

describe.runIf(host)('the Firestore storage driver', () => {
  const app = initializeApp({ projectId: 'demo-did-it-last' }, 'emulator-tests')
  const firestore = getFirestore(app)
  const [hostname, port] = (host ?? 'localhost:8080').split(':')
  connectFirestoreEmulator(firestore, hostname!, Number(port))

  let driver: ReturnType<typeof firestoreDriver>
  let storage: Storage
  let run = 0
  beforeEach(() => {
    run += 1
    driver = firestoreDriver({ firestore, collection: `tests/run-${Date.now()}-${run}/entries` })
    storage = createStorage({ driver })
  })
  afterAll(async () => {
    await terminate(firestore)
    await deleteApp(app)
  })

  it('starts empty', async () => {
    expect(await storage.getKeys()).toEqual([])
    expect(await storage.hasItem('nothing')).toBe(false)
    expect(await storage.getItem('nothing')).toBeNull()
  })

  it('gives back what was saved, objects included', async () => {
    await storage.setItem('s1:a', 'test_data')
    await storage.setItem('s2:a', { n: 1, list: ['x'] })
    expect(await storage.hasItem('s1:a')).toBe(true)
    expect(await storage.getItem('s1:a')).toBe('test_data')
    expect(await storage.getItem('s2:a')).toEqual({ n: 1, list: ['x'] })
  })

  it('accepts keys that are not valid Firestore ids as they are', async () => {
    const awkward = ['__name__', 'a.b', '...x', '100%', 'emoji:🥨', 'spaces and "quotes"']
    for (const key of awkward) await storage.setItem(key, key)
    for (const key of awkward) expect(await storage.getItem(key)).toBe(key)
    expect((await storage.getKeys()).sort()).toEqual([...awkward].sort())
  })

  it('escapes keys reversibly and never into a reserved id', () => {
    expect(escapeKey('.')).toBe('%2E')
    expect(escapeKey('__a__')).toBe('%5F%5Fa%5F%5F')
    expect(decodeURIComponent(escapeKey('a/b.c_d%e'))).toBe('a/b.c_d%e')
  })

  it('lists only the keys under a base', async () => {
    await storage.setItems([
      { key: 'changes:1', value: 1 },
      { key: 'changes:2', value: 2 },
      { key: 'changed', value: 3 },
      { key: 'other:1', value: 4 },
    ])
    expect((await storage.getKeys('changes')).sort()).toEqual(['changes:1', 'changes:2'])
    expect(await storage.getKeys('none')).toEqual([])
  })

  it('reads many keys at once, beyond one query batch, with missing ones as null', async () => {
    const keys = Array.from({ length: 45 }, (_, n) => `k:${n}`)
    await storage.setItems(keys.map((key, n) => ({ key, value: n })))
    const read = await storage.getItems([...keys, 'k:missing'])
    expect(read).toHaveLength(46)
    expect(read[44]).toEqual({ key: 'k:44', value: 44 })
    expect(read[45]).toEqual({ key: 'k:missing', value: null })
  })

  it('removes one key, or everything under a base', async () => {
    await storage.setItems([
      { key: 'a:1', value: 1 },
      { key: 'a:2', value: 2 },
      { key: 'b:1', value: 3 },
    ])
    await storage.removeItem('a:1')
    expect(await storage.hasItem('a:1')).toBe(false)
    // Straight to the driver: unstorage's own clear(base) only reaches mounts under base.
    await driver.clear!('b:', {})
    expect(await storage.getKeys()).toEqual(['a:2'])
    await storage.clear()
    expect(await storage.getKeys()).toEqual([])
  })

  it('tells when a key was last written', async () => {
    const before = Date.now() - 60_000
    await storage.setItem('dated', 1)
    const { mtime } = await storage.getMeta('dated')
    expect(mtime).toBeInstanceOf(Date)
    expect((mtime as Date).getTime()).toBeGreaterThan(before)
  })

  it('reports writes made after watching starts', async () => {
    await storage.setItem('existing', 1)
    const events: string[] = []
    const unwatch = await storage.watch((event, key) => events.push(`${event} ${key}`))
    await storage.setItem('fresh', 2)
    await storage.removeItem('existing')
    await expect.poll(() => events).toEqual(['update fresh', 'remove existing'])
    await unwatch()
  })

  it('answers reads from the live listener while watching, kept current by other clients', async () => {
    await storage.setItems([
      { key: 'log:1', value: 1 },
      { key: 'other', value: 2 },
    ])
    const unwatch = await storage.watch(() => {})
    expect(await storage.getKeys('log')).toEqual(['log:1'])
    expect(await storage.getItems(['log:1', 'log:2'])).toEqual([
      { key: 'log:1', value: 1 },
      { key: 'log:2', value: null },
    ])

    // Another client writing to the same collection.
    const otherClient = createStorage({ driver: firestoreDriver(driver.options!) })
    await otherClient.setItem('log:2', 3)
    await expect.poll(() => storage.getItem('log:2')).toBe(3)
    expect(await storage.hasItem('log:2')).toBe(true)
    expect((await storage.getMeta('log:2')).mtime).toBeInstanceOf(Date)

    await unwatch()
    expect(await storage.getItem('log:2')).toBe(3)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import unstorageMemory from 'unstorage/drivers/memory'

import type { Account } from '@/account'
import App from '@/App.vue'
import { routes } from '@/router'
import { useDriver } from '@/storage'
import { localDate } from '@/time'

// Stand-ins for Firebase: a fake account, and memory storage instead of the cloud.
const auth = vi.hoisted(() => ({ account: null as Account | null, signIn: () => {} }))
vi.mock('@/firebase', () => ({ isFirebaseConfigured: () => true }))
vi.mock('@/account', () => ({
  watchAccount: (onChange: (a: Account | null) => void) => {
    onChange(auth.account)
    auth.signIn = () => onChange((auth.account = { uid: 'u1', name: 'Test', email: null }))
    return () => {}
  },
  signInWithGoogle: async () => auth.signIn(),
  signOutOfAccount: async () => {},
}))
vi.mock('@/storage', async (original) => {
  const storage = await original<typeof import('@/storage')>()
  return { ...storage, useAccountStorage: () => {} }
})

async function openApp(path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  mount(App, {
    global: { plugins: [createPinia(), router, createVuetify({ components, directives })] },
    attachTo: document.body,
  })
  await flushPromises()
  return router
}

describe('the app', () => {
  beforeEach(() => {
    useDriver(unstorageMemory())
    auth.account = { uid: 'u1', name: 'Test', email: null }
  })

  it('asks a signed-out user to sign in first, then shows their list', async () => {
    auth.account = null
    await openApp()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /sign in with google/i }))
    await flushPromises()
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument()
  })

  it('opens on an empty list with one big button to add something', async () => {
    await openApp()
    expect(await screen.findByRole('link', { name: /add something/i })).toBeInTheDocument()
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument()
  })

  it('shows a newly added item in the list, counting from the day it was bought', async () => {
    const router = await openApp('/items/new')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('What is it?'), 'Kettle')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(await screen.findByText('Kettle')).toBeInTheDocument()
    expect(screen.getByText(`Bought ${localDate()}`)).toBeInTheDocument()
    expect(screen.getByText('0 days so far')).toBeInTheDocument()
  })

  it("won't save an item without a name", async () => {
    await openApp('/items/new')
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

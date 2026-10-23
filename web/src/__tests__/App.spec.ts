import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import unstorageMemory from 'unstorage/drivers/memory'

import App from '@/App.vue'
import { routes } from '@/router'
import { useDriver } from '@/storage'
import { localDate } from '@/time'

async function openApp(path = '/') {
  useDriver(unstorageMemory())
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

// Global test setup, loaded through `setupFiles` in vitest.config.ts.
import '@testing-library/jest-dom/vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach } from 'vitest'

// jsdom lacks a few browser APIs that Vuetify uses.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// Unmount whatever a test mounted, then drop what Vuetify left in the body
// (the overlay container that dialogs teleport into).
enableAutoUnmount(afterEach)
afterEach(() => {
  document.body.innerHTML = ''
})

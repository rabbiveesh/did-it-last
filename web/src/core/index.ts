// The app's only entry point into the Rust core (../../core).
// Components and stores import from here, never from 'did-it-last-core' directly,
// so the core can be wrapped, mocked or moved behind a server without touching callers.
export * from 'did-it-last-core'

# Did It Last

An app for keeping track of things you bought (often the pricier ones), with the date each was bought, so you can see how long they last. Product requirements live in `docs/requirements.md`; read them before building anything, and update them when a decision changes.

## How work arrives

Requests come from the developer and follow normal practice: a branch and a pull request, with CI green before merge. CI deploys `master` to GitHub Pages, so a merged change is live a few minutes later.

## No personal names

Never put anyone's name in the repository: not in code, data, docs, tests, commit messages or UI copy. Say "the user". Anything personal (a name to greet, a goal) is user data entered in the app, never code.

## Golden rule: never reinvent wheels

Kittens die when you do that. Before writing any non-trivial utility, look for a well-maintained library that already does it and use that. Hand-rolled code is only for logic that is genuinely specific to this app (the item and lifespan rules).

## Do things the right way, not the short way

The short way leads to more dead kittens. Prefer the properly typed, tested, maintainable approach even when a shortcut would work today. For example, TypeScript types for the Rust core are generated from the Rust structs (tsify), not hand-copied. Values cross the wasm boundary as typed objects (tsify `Ts<T>`), not JSON strings. CI runs the tests and lints. Vibe coding sets the pace, not the quality bar.

## Stack

- **Core logic: Rust** (`core/`), compiled to WebAssembly with `wasm-pack`. Pure functions over data: items, lifespans and the order of the list. No I/O, so it can be lifted directly into a future backend.
- **Frontend: Vue 3 + TypeScript SPA** (`web/`), built with Vite.
  - Component framework: **Vuetify** (mobile-first, large touch targets).
  - State: **Pinia**. Routing: **vue-router** (hash history, for GitHub Pages).
  - **vite-plugin-wasm** loads the Rust core. **vite-plugin-pwa** makes it installable and offline. Shipping as a PWA is deliberate: it's the simplest way to ship.
- **Storage: unstorage**, behind the app's own storage module (`web/src/storage`). Every read and write goes through that module, via `web/src/data/repository.ts`. Signed in, it uses a Firestore driver (`web/src/storage/firestore.ts`) that keeps each key as a document under the user's own `users/{uid}`; each item is its own key. Tests use the memory driver.
- **Sign-in and cloud data: Firebase** (free Spark plan). Google sign-in through Firebase Auth (`web/src/account`), data in Cloud Firestore with its offline cache. Only `web/src/firebase.ts`, `web/src/account` and the storage driver know about Firebase. Access rules are in `firestore.rules`; console setup is in `docs/firebase-setup.md`.
- **Hosting: GitHub Pages**, deployed by GitHub Actions on every push to `master`.
- **AI (Claude API): keep it to a minimum**, since every call costs money.

## Checks before every push

```sh
cd core && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
cd core && wasm-pack build --release --target bundler --out-dir pkg --out-name did_it_last_core
cd web && npx prettier --check src/ && npx oxlint . && npx eslint . && npx vitest run && npm run build
```

## Product principles

From `docs/requirements.md`, which wins where they differ.

- Adding an item is quick: a name and the day it was bought, with today filled in.
- The list answers the question at a glance: how long has each thing lasted, or how long is it lasting so far.
- Big, clear views; one obvious thing to do on each screen.

## Assume you're wrong

When you confidently assume you're right, you kill kittens. Assume you're wrong about the requirements, about how the user interacts with the app, and about the data model. Shape the code so that being wrong has the smallest possible blast radius. A simple change that turns into a big one also kills kittens. In practice:

- Keep modules small, with narrow interfaces, so one wrong idea is fixed in one place.
- Version stored data and migrate it explicitly (`web/src/data/migrations.ts`), because the data model will change. Never break data already saved.
- Keep the app's UI decoupled from the item rules and from storage.
- Prefer configuration and data over hard-coded behaviour.
- Don't embed things in the wrong place. Item and lifespan rules live in the Rust core, never in Vue components. Persistence goes only through the storage module. Putting something where it's convenient instead of where it belongs is a shortcut, and shortcuts kill kittens.

## Abstractions follow the data, and compose cleanly

Abstractions that aren't about the data make programming harder, not easier, and they kill kittens. So do things that don't compose cleanly. Name and shape modules after the domain data (items, purchases, lifespans), not after generic machinery. Prefer small pure functions that take data and return data, and combine them, over frameworks, managers, wrappers or class hierarchies. If a piece can't be reused without dragging its surroundings along, it's shaped wrong.

Interfaces must not lie. A name, type or function must do exactly what it claims, no more and no less. Jumping through interfaces that pretend to be something they aren't is the worst kitten killer of all.

## Tests express intent

Test names say what the user would notice ("a finished item shows how long it lasted"), not which function was called.

## Kitten death toll

Finish every piece of work for the developer (each PR, each reply that reports finished work) with a **kitten death toll**: an honest count of the shortcuts taken and wheels reinvented, with each one named, why it happened, and what would fix it. Zero is the goal. Never round down.

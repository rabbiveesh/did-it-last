# Did It Last: requirements

## The idea

Keep a list of things you bought, each with the date it was bought, so you can see how long they last. It's mostly for the pricier things, where knowing "the last one lasted two years" helps decide what to buy next.

## What it does today (v1)

- **Add an item**: a name and the day it was bought (today by default).
- **Mark it done**: when it breaks, wears out or runs out, record the day. This is optional; until then the item is "still going".
- **The list**: every item with how long it lasted, or how many days so far if it's still going. Items still going come first, then the newest purchases.
- **Edit or delete** an item (delete asks first).
- Works offline and installs on a phone (PWA).

## Planned

- **Sign-in and cloud storage**, so the list follows the user to any device. It must fit a static site on GitHub Pages and stay on a free tier. Options compared on 2026-10-23: Firebase (recommended), Supabase, Cloudflare Workers + D1, PocketBase. Waiting on the developer's choice.

## Open questions

- Is a price per item worth recording (cost per day of use)?
- Are notes, a category or a photo useful?

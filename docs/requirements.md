# Did It Last: requirements

## The idea

Keep a list of things you bought, each with the date it was bought, so you can see how long they last. It's mostly for the pricier things, where knowing "the last one lasted two years" helps decide what to buy next.

## What it does today (v1)

- **Add an item**: a name and the day it was bought (today by default).
- **Mark it done**: when it breaks, wears out or runs out, record the day. This is optional; until then the item is "still going".
- **The list**: every item with how long it lasted, or how many days so far if it's still going. Items still going come first, then the newest purchases.
- **Edit or delete** an item (delete asks first).
- Works offline and installs on a phone (PWA).

- **Sign in with Google**; the list is kept in the cloud and follows the user to any device. It still opens and saves offline, and syncs when back online.

## Decisions

- **Cloud: Firebase** (Auth + Firestore, free tier), chosen 2026-10-23 over Supabase (free projects pause after a week unused), Cloudflare Workers + D1 (no built-in sign-in) and PocketBase (needs a server). It fits a static site on GitHub Pages.
- **Edits from several devices merge; real clashes ask the user.** Chosen 2026-10-24. Every edit is kept as an add-only change. Edits to different fields (a rename on one device, marking it done on another) both survive. The same field changed on two devices at once is flagged on the item, showing the newest meanwhile, and the user picks which value is right. Deleting is recorded too, so an item deleted on one device while being changed on another is flagged and the user chooses to keep or delete it.
- **No passkeys for now.** Firebase has no built-in passkey sign-in; adding one needs a server function and the pay-as-you-go plan. Google sign-in, which stays signed in per device, is enough.

## Open questions

- Is a price per item worth recording (cost per day of use)?
- Are notes, a category or a photo useful?

# Design Decisions

Records of notable architectural and product decisions. Newest on top.
Status is one of: `proposed` | `accepted` | `superseded`.

---

## D-005 — Share-to-save: save first, enrich metadata in the background

**Status:** accepted  
**Date:** 2026-09-23

### Context
Users want to save a link to the library by sharing it from another app
(iOS Share sheet / Android `ACTION_SEND`). Bookmarks are URL-centric, so only
`text/*` shares are accepted. To make the pin useful we want page metadata
(title, description, og:image, site name, type, language, publish date), but
fetching it should never block the UI.

### Decision
- **Instant save first.** On save we insert the row immediately from the URL
  alone: `urlHash` (djb2 hex, satisfies the unique `url_hash` column), parsed
  `domain`/`path`, hostname as placeholder title, Google-S2 favicon,
  `type='link'`.
- **Async in-app enrichment.** A fire-and-forget `enrichBookmark(id, url)`
  fetches the page (native async I/O — runs off the JS/UI thread), regex-parses
  metadata, and `updateBookmark`s the row when it resolves. One retry on network
  failure; on failure the bookmark remains hostname-only.
- **Stay on the add screen.** After save we show a "Saved — fetching details…"
  state and render the full pin preview the moment metadata resolves, then the
  user taps Done back to the Library.
- **No background task / queue.** Single-user app; a user cannot save bookmarks
  at bulk rate, so `expo-background-task` (15-min minimum on Android) delivers
  no benefit. Enrichment completes while the app is foregrounded.
- **Dedup.** Check `getBookmarkByUrlHash` before insert and alert "Already saved".

### Why not
- `expo-share-intent` (community) — the first-party `expo-sharing` module
  (SDK 54+) covers both platforms with `useIncomingShare()` + the
  `expo-router` `+native-intent.ts` hook.
- A queue/background task — over-engineering at this scale; adds native config
  and delays alerts for no real win.

### Notes
- Requires a dev/native build (`npx expo prebuild --clean` + `expo run:android`);
  share receiving does not work in Expo Go.
- Uses Google's S2 favicon service (same source as the seed data).

---

## D-004 — No image is fine: conditional image rendering

**Status:** accepted  
**Date:** 2026-09-23

### Context
Shared links often lack an `og:image`. Growing the app's surface with a
placeholder-image pipeline (Skia text→image generation, placeholder services)
adds weight for little value.

### Decision
- `PinCard` and the Manage-screen row render the image block **only when
  `pin.image` is non-empty**; otherwise the card shows favicon, title, source
  and type — the link and its details are enough.
- When there is no image the masonry reserve height is `0`
  (`imageHeightFor`, `splitColumns`, `estimateCardHeight`) so no blank slot is
  left in the grid.

### Why not
- `@shopify/react-native-skia` placeholder generation — heavy native dependency
  for an image that communicates nothing beyond what the favicon/title already
  show.

---

## D-003 — Single SQLite connection (fix for `NativeDatabase.prepareSync` NPE)

**Status:** accepted  
**Date:** 2026-09-23

### Context
Intermittent Android crash `NativeDatabase.prepareSync` rejected →
`java.lang.NullPointerException` in `loadBookmarksPage`. Root cause: the same
database file was opened multiple times (`db/client.ts` module-scope,
an unused `db/index.ts`, plus `SQLiteProvider` and a per-render
`openDatabaseSync` in `_layout.tsx`'s `Migrations`). On SDK 53–57
(regression of `expo/expo#35818`), a garbage-collected duplicate `NativeDatabase`
wrapper releases the shared native handle, poisoning every other wrapper with a
bare NPE on `prepareSync`.

### Decision
- `db/client.ts` is the single owner of the connection
  (`SQLite.openDatabaseSync` + drizzle).
- `db/index.ts` re-exports `db` from `./client` (no second connection).
- `_layout.tsx` no longer uses `SQLiteProvider`; `Migrations` runs
  `useMigrations(db, migrations)` on the shared instance and gates rendering
  until migrations succeed.

### Notes
- Because Android can keep a poisoned DB handle per process, a clean rebuild
  (`adb uninstall` / fresh run) is required after deploying this fix.
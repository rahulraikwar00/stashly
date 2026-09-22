# Design Decisions

Records of notable architectural and product decisions. Newest on top.
Status is one of: `proposed` | `accepted` | `superseded`.

---

## D-007 — Instant done: render the card now, update in place when metadata lands

**Status:** accepted  
**Date:** 2026-09-23

### Context
D-006 added a server-side extraction fallback that can take several seconds
(walled platforms). D-005 showed a loading state until enrichment resolved, which
leaves the user staring at a spinner on exactly the slow cases.

### Decision
- The add-bookmark screen sets `status='done'` **immediately** after the row is
  inserted and shows a pin card built from the URL alone (hostname title, Google
  S2 favicon, no image — per D-004).
- Enrichment runs un-awaited; when it resolves, the card is updated **in place**
  via `setBookmark({ ...prev, ...metadata })`.
- The "Saved" subtitle reflects the phase: *"Saved! Fetching the title and
  image…"* → *"Title, image and details loaded automatically."* (or a
  saved-with-domain-only note on failure).
- On completion we re-flag `pendingRefresh` so the Library refetches on its next
  focus if the user has already left the screen.

---

## D-006 — Server-side metadata extractor (backend/) with crawler-UA fallback

**Status:** accepted  
**Date:** 2026-09-23

### Context
Instagram reels (and similar platforms: TikTok, Pinterest, X/Twitter) serve a
consent/JS shell with **no og tags** to browser-like clients, so the device-side
direct fetch (`utils/metadata`) returns an empty result and the card stays
hostname-only. Verified empirically: changing only the User-Agent to a crawler
UA (`Googlebot` / `facebookexternalhit`) makes Instagram serve the real
`og:title` (caption), `og:description` (24K likes…), and `og:image` (thumbnail)
in static HTML — no headless browser needed.

### Decision
- New `backend/` folder: a small FastAPI service (`httpx` + regex og/twitter
  parse) that fetches server-side with a **crawler UA for walled hosts** and a
  normal browser UA otherwise.
  - `GET /health`, `GET /metadata?url=…&timeout_ms=…`.
  - Response mirrors the app's `NewBookmark` fields (title, description, image,
    favicon, siteName, author, publishedAt, language, type).
  - HTTP(S) URLs only; SSRF guard rejects hosts resolving to private/reserved
    addresses (including the cloud-metadata 169.254.169.254).
- **Tiered enrichment** in `enrichBookmark(id, url)`:
  1. direct device-side `fetchPageMetadata` — private and fast for normal sites;
  2. if the direct result is empty, **or** the host is in `WALLED_HOSTS`
     (`instagram.com`, `tiktok.com`, `pinterest.com`, `x.com`, `twitter.com`,
     `youtube.com`), call the extractor.
- **Extractor URL resolution** (`utils/metadata.ts`): `EXPO_PUBLIC_METADATA_EXTRACTOR_URL`
  env → else `http://<dev-machine-ip>:8000` derived from Expo `hostUri` (local
  dev auto-works on device) → else `null`.
- **Interim plumbing:** when no self-hosted extractor is configured, fall back to
  the free public API that powers `react-native-preview-url`
  (`azizbecha-link-preview-api.vercel.app/get`), so the flow works today. Adapter
  maps its `{title, description, images[0].url, favicons}` shape; swap to the
  self-hosted server is a one-line env change.

### Why not
- Playwright/headless-browser tier — unnecessary; the crawler UA already gets
  full static og tags from the walled sites we care about. Revisit only if a
  JS-only platform appears.
- Installing `react-native-preview-url` — we don't render live previews; we
  persist to SQLite. Calling its underlying extraction API directly is enough.
- Relying on a third-party API as the permanent path — uptime/rate-limit/privacy
  concerns; the self-hosted `backend/` is the durable choice.

### Notes
- `og:image` values may contain HTML entities (`&amp;`); both the server and the
  app decode entities on image URLs before storage.
- Running the phone against a local server: Android emulator reaches the host via
  the Expo `hostUri` host (the dev machine's LAN IP), not `localhost`.

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
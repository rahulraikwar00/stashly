# Design Decisions

Records of notable architectural and product decisions. Newest on top.
Status is one of: `proposed` | `accepted` | `superseded`.

---

## D-013 — Metadata extractor URL comes from Profile settings (env only prefills)

**Status:** accepted  
**Date:** 2026-09-23

### Context

D-012 reserved `settings.serverUrl`/`apiKey` but left them unwired; the
extractor still resolved `EXPO_PUBLIC_METADATA_EXTRACTOR_URL` at module load.
That env value is a machine-specific LAN IP (`http://172.26.6.148:8000`)
that cloud EAS builds cannot bake in, and hardcoding an endpoint is exactly
what the settings table was meant to avoid.

### Decision

- **Env's sole role is prefilling:** `db/settingsService.ts` seeds the initial
  `settings.serverUrl` from `EXPO_PUBLIC_METADATA_EXTRACTOR_URL` when the row is
  created (Env read once). After creation the app never re-reads env — the
  value is user-controlled in Profile → Self-hosted server, and clearing it
  stays cleared.
- **Resolve at enrichment time** (`utils/metadata.ts`): module constant
  `METADATA_EXTRACTOR_URL` and sync `resolveExtractorBaseUrl` removed. New
  async `resolveExtractorConfig()` consulted by `fetchExtractedMetadata()`:
  1. `settings.serverUrl` (+ `settings.apiKey` sent as `Authorization: Bearer`),
  2. http://<dev-machine-ip>:8000 from Expo `hostUri` (dev fallback when the
     field is empty),
  3. null → interim azizbecha API.
- **Headers plumbing:** `fetchJsonWithOutcome` / `fetchMetadataViaExtractor`
  accept an optional headers record for the bearer token (our backend ignores
  it today; future Chrome extension can reuse the same keys).
- **Nothing baked into builds:** an EAS build without env works out of the box;
  the built app configures its own extractor from Profile at runtime. No
  key/URL in `eas.json` or git.

### Why not

- Baking the URL/key at build time (env in EAS profile, `app.json extra`) —
  recompiles on every change and leaks endpoints; defeats the settings row.
- Reading env again at runtime — would resurrect a value the user cleared.

### Notes

- Supersedes the extractor-URL resolution paragraphs in D-012 (reserved fields)
  and D-006 (env → hostUri resolution); the tiered enrichment flow itself is
  unchanged.
- **Amended (2026-09-23, user feedback):** env is applied not only at row
  creation but also **backfilled whenever the stored `serverUrl` is empty**
  (`loadSettings`). Env acts as the default value the user can change and save
  over. Consequence: in dev builds (env always present) clearing the field and
  restarting re-asserts the env URL; builds without env leave it fully
  user-controlled.

---

## D-012 — Profile & settings (local-first), server verification documented as a spec

**Status:** accepted  
**Date:** 2026-09-23

### Context

The compact header (D-011) reserved a placeholder profile avatar with no
behavior. The app is local-first (single-user SQLite) and the backend
(`backend/`) is only a metadata extractor — there is no user identity or auth
anywhere. We want basic user details reachable from the avatar, plus storage
for a future self-hosted backend (server URL + API key) so nothing is hardcoded
in `env`, and to plan the future Chrome extension against the same endpoint.

### Decision

- **Storage: local-only.** New single-row `settings` table (`id = 1`,
  get-or-create in `db/settingsService.ts`) via drizzle migration `0001`
  (registered in `drizzle/migrations.js`). Columns: `displayName`, `username`,
  `email`, `avatarUri`, `theme` (`system|light|dark`), `defaultStatus`
  (`all|favorites|unread|archived`), `serverUrl`, `apiKey`, `updatedAt`.
- **Entry point:** the header avatar opens `components/Profile/ProfilePopover.tsx`
  (same `PopupCard` shell as every other action — D-009/011). Sections:
  identity (avatar + name/@username/email), preferences (theme + default view
  chips), and a collapsible **Self-hosted server** group (URL + masked API key)
  with a "not connected yet" note.
- **Avatar:** picked via `expo-image-picker`, copied into the app document
  directory (`expo-file-system` new `File`/`Paths` API) so it survives cache
  purges; empty → initials circle (`UserAvatar`).
- **Theme override:** `hooks/useSettings.tsx` `SettingsProvider` loads settings
  at the root (children gated until loaded) and calls nativewind
  `setColorScheme('light'|'dark'|'system')`; `ThemedRoot` picks the expo-router
  theme from the stored preference, falling back to the OS scheme for `system`.
- **Default view:** `HomeScreen` seeds its `status` filter from
  `settings.defaultStatus`.
- **Server fields are reserved, not wired:** nothing in `utils/metadata.ts`
  reads them yet; the extractor keeps the existing env/hostUri resolution.
  When a backend arrives, `settings.serverUrl`/`apiKey` supersede it.
- **Server verification = documentation only** (no endpoint built): the full
  client + future-server rule table lives in `utils/profile.ts` comments and
  the field validators are enforced client-side at save time.

### Verification rules (client now → future server later)

| Field                 | Client rule                                                  | Future server rule                                                                       |
| --------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| displayName           | required, ≤50, no control chars                              | same + strip HTML                                                                        |
| username              | optional, `^[a-z0-9_]{3,20}$`, lowercase                     | same + uniqueness, reserved list, rate limit                                             |
| email                 | optional, `^[^\s@]+@[^\s@]+\.[^\s@]+$`, ≤254, lowercase      | same + uniqueness, verify (OTP/magic), TLS only                                          |
| avatarUri             | `file://`, `content://`, or `https://` only                  | upload ≤2 MB, store a ref, never arbitrary URL                                           |
| serverUrl             | if set, absolute `http(s)://`, trailing slash stripped       | TLS only, origin allowlist for hooks                                                     |
| apiKey                | optional, 8–128 chars `[A-Za-z0-9._-]`, never logged/exposed | constant-time compare, `Authorization: Bearer`, hashed storage, rotation, per-key limits |
| theme / defaultStatus | enum whitelist                                               | enum whitelist, ignore unknown                                                           |

### Why not

- Server-backed identity/user table — no auth exists and nothing needs it today;
  local-first matches the architecture. The server rules are already specced so
  the future backend (and Chrome extension) can adopt them unchanged.
- Hardcoding `serverUrl`/`apiKey` in `env` — settings keep config editable in
  the app and reusable by the extension.

### Notes

- New native deps: `expo-image-picker`, `expo-file-system` → requires a
  dev/native rebuild to run.
- Android may keep a poisoned DB handle per process; the `settings` migration
  is additive, but a clean rebuild is advised when testing on device.

---

## D-011 — Compact header: filters behind an icon, profile slot reserved

**Status:** accepted  
**Date:** 2026-09-23

### Context

The Library header stacked a 28px title + subtitle, a full-width search bar,
and two horizontal filter-chip rows — roughly ~218px before any pin. Two chip
rows (type + status, two "All"s) were especially noisy and duplicated a control
that needs few taps.

### Decision

- **One-row header:** "Bookmarks" (24px) + search bar. Subtitle and both
  `FilterChips` rows removed (`components/Home/FilterChips.tsx` deleted).
- **Search bar** stays full-width and gains an optional `trailing` slot
  (`components/Home/SearchBar.tsx`) hosting a `filter` icon. When any filter is
  active the icon tints primary and a small dot appears.
- **`components/Home/FilterPopover.tsx`** (new, `PopupCard` shell) holds every
  option as wrapping chips in Type + Status sections (status chips carry
  leading icons), applies **live** on tap, and offers a context-sensitive
  "Clear". Keeping the search bar full-width reserves the heading's right side
  for a placeholder **profile avatar** (person icon, no-op for now) that will
  hold user identity later.
- Old header height ~218px → ~90px.

### Why not

- Merging both chip rows into one shared-stack horizontal scroller — two "All"
  semantics and cross-group selection made the chip API convoluted; a popup is
  a single tap away and extensible (favorites, saved, recent…).

---

**Status:** accepted  
**Date:** 2026-09-23

### Context

D-009 moved every bookmark interaction onto the cards as centered popups and
introduced the bottom-center AddDock. The add flow still lived in a
full-screen modal route (`src/app/add-bookmark.tsx`). The flow only needs to
capture one URL and show a saved preview — nowhere near a full screen of
detail — so a second full-screen page is unnecessary chrome.

### Decision

- New `components/Pin/AddBookmarkPopover.tsx` ported from `add-bookmark.tsx`,
  rendered inside the existing `PopupCard` (dimmed backdrop, tap-outside/✕
  close). States: idle (URL input) → saving (spinner) → saved.
- **Keep the instant-done behavior (D-007):** after Save the popup stays open,
  the full preview card appears, and enrichment updates it **in place** as the
  metadata lands; the user taps **Done** to close.
- The Library refreshes via a new `onSaved` callback (fired after insert and
  after enrichment completes, mirroring the old `markSavingComplete` double
  fire) instead of the `useFocusEffect`/`pendingRefresh` flag — there is no
  navigation focus change anymore. `hooks/pendingRefresh.ts` deleted.
- `AddDock` takes an `onPress` prop (no more `router.push`); `HomeScreen` owns
  `showAdd` and renders the popover.
- Share-to-save is unchanged in feel: `+native-intent.ts` now redirects the
  system share to `/` (the Library); the popover auto-opens (`visible ||
hasPendingShare`) with the shared URL pre-filled and clears the payload on
  save or dismiss. `src/app/add-bookmark.tsx` deleted.

### Why not

- Keeping the full-screen route — the content (one input + one preview) fits a
  centered card and stays consistent with every other action (D-009); a route
  would add a transition and a redundant header.

---

**Status:** accepted  
**Date:** 2026-09-23

### Context

Management actions lived in a separate Manage tab (favorite/read/archive/delete
rows, All/Favorites/Unread/Archived scopes). The Library grid was not
interactive — tapping a card did nothing. Users expect to act on a bookmark
from the card itself: long-press (or a ⋯ button) for quick actions, tap for
details.

### Decision

- **Manage tab deleted.** Cards carry every action — optimistic toggles
  (favorite, read, archive), delete (with Alert confirm), copy URL, and open link.
  Archived items remain reachable via a new **Archived** status chip in the
  Library's filter row (query maps `archived: chip === 'archived'`). The app is
  now a single root screen (`src/app/index.tsx`, Library) + the
  `add-bookmark` modal; tab bar removed.
- **Card interactions** (`PinCard`): `onPress` → detail popover;
  `onLongPress` (350ms) / the ⋯ button → action popover. The ⋯ sits over the
  image top-right (or in the caption row when image-less); nested-Pressable
  responder routing keeps it from triggering the card tap.
- **Centered popup cards** (`components/Pin/`): `PopupCard` (RN Modal, dimmed
  backdrop, tap-outside/✕ to close), `PinActionMenu` (Open link · View details
  · Favorite · Read · Archive · Copy URL · Delete) and `PinDetailPopover`
  (image, title, source, description, tags, notes, URL, added date, Open-link
  button + icon toggles).
- **Optimistic state** (`hooks/usePinMutations.ts`): toggles apply instantly,
  drop the pin from view when it no longer matches the active filters, and roll
  back on error — reusing the pattern the Manage screen had. The open popover
  stays in sync via an `onMutated` callback and closes when the pin leaves the
  current view (or is deleted).
- **`Pin` view-model extended** with `url`, `notes`, `author`, `createdAt` —
  all already exist on the `bookmarks` table, so **no schema/migration change**.
- **Bottom-center Add button** (`AddDock`): circular primary FAB above the
  safe-area inset replaces the old header + button; opens `/add-bookmark`.
- **Relative age** on each card caption (`· 10d`) via `formatRelativeTime`
  (`2s · 10m · 5h · 10d · 3w · 9mo · 1y`); detail popover also shows the exact
  date via `formatPinDate`.
- **Copy URL** uses `expo-clipboard`; link launch uses `Linking.openURL` and
  marks the pin read on open.

### Why not

- Keeping the Manage tab — redundant once cards expose the same actions and
  the Archived filter is a chip; a second tab would duplicate scope/state.
- A bottom-sheet library (`@gorhom/bottom-sheet`) — centered popover cards
  match the brief and need no new native deps (only a CLI-installed
  `expo-clipboard`).

---

**Status:** accepted  
**Date:** 2026-09-23

### Context

Fetched thumbnails (e.g. Instagram `scontent.cdninstagram.com/...?stp=..._s640x640..`)
have no parseable `/WIDTH/HEIGHT` path segments, so `getImageAspectRatio`
returned `null` and every card fell back to `DEFAULT_IMAGE_RATIO` — a uniform
"fixed" height look. Separately, the masonry grid was hard-coded to two columns,
so tablets rendered two oversized columns instead of a denser layout.

### Decision

- **Phase A — aspect-ratio detection ladder** in `getImageAspectRatio`
  (`utils/pin.ts`):
  1. WordPress-style filename suffix `…-1024x683.jpg`;
  2. explicit query params `w=` / `h=` (Cloudinary, Imgix);
  3. `s{width}x{height}` hints in params/query (Instagram `s640x640` → ratio 1.0);
  4. plain integer path segments (picsum `/400/600`) — kept as a later fallback.
     Unknown URL shapes still fall back to `0.7`. Image heights are always
     `columnWidth × ratio` (`imageHeightFor` unchanged) — the column width is the
     only controlled dimension, preserving the image's original aspect ratio.
- **Phase B — responsive N-column masonry:**
  - `splitColumns` (hardcoded `{left, right}`) replaced by `splitIntoColumns`
    (balanced by accumulated ratio height) in `utils/pin.ts`;
  - `MasonryGrid` derives the column count from container-width breakpoints
    (`<600` → 2, `600–959` → 3, `≥960` → 4) and computes each column's width
    from that count — wider devices/landscape get more, narrower columns.
- The 180px add-bookmark preview and 52×52 Manage thumbnails stay as
  intentional fixed crops.

### Why not

- Measuring true pixels on-device (`Image.getSize`) and persisting a ratio
  column: accurate for every CDN, but needs a drizzle migration, async
  measurement, and a height jump when the ratio lands after first render.
  Deferred as a backlog item unless a site's URLs defeat all patterns.

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
- The "Saved" subtitle reflects the phase: _"Saved! Fetching the title and
  image…"_ → _"Title, image and details loaded automatically."_ (or a
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

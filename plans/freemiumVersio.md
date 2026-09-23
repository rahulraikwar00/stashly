Here's a complete guide you can hand to an AI agent (or a new engineer) to build this correctly. It covers the goal, the contract, and exactly what to check/change in both the backend and frontend.

---

# AI Agent Build Guide — Two-Tier Instagram Bookmark App

## 0. The Goal (read this first)

Build a bookmarking app with **two ingestion paths** that write to **one SQLite table** in **one row shape**.

| Tier | Path | Backend needed? | Metadata source |
|---|---|---|---|
| **Free** | User pastes a URL in the app | **No** | Public link-preview API (unauthenticated) |
| **Paid** | User connects Instagram; backend reads DMs | **Yes** (FastAPI + instagrapi) | The DM payload itself |

**Hard rule:** both paths must produce the *exact same* `Bookmark` row shape. If they diverge, dedup breaks and the UI can't render one tier's rows the same as the other's.

---

## 1. The Data Contract (non-negotiable)

### 1.1 The `Bookmark` row shape

Every insert — free or paid — must fill every column in `db/schema.ts`. No exceptions.

```
url, urlHash, domain, path
title, description, image, favicon, siteName, author,
publishedAt, language, type
tags, notes, isFavorite, isArchived, isRead
customTitle, customDescription
createdAt, updatedAt, lastViewedAt, viewCount
```

### 1.2 Value conventions (violating these breaks Drizzle)

| Field type | Value | Never |
|---|---|---|
| Text columns (`.notNull().default('')`) | `""` | `null` |
| `publishedAt`, `lastViewedAt` | `null` allowed | — |
| Booleans | `false` | `null` |
| `tags` | JSON string `'[]'` or `'["pizza"]'` | raw array, `null` |
| Timestamps (`createdAt`, `updatedAt`, `publishedAt`) | **milliseconds** | seconds |

### 1.3 The override pattern

- `title` / `description` = auto-extracted metadata (from API or DM payload)
- `customTitle` / `customDescription` = user-typed text (DM sender's sentence, or manual edit)
- **Read side:** `effective = customX || X`

Never write the user's typed text into `description`. That field is reserved for auto metadata.

### 1.4 `urlHash` is the dedup key

- Algorithm: SHA-256 of the canonical URL string
- Same URL shared twice → same hash → `onConflictDoNothing({ target: urlHash })` skips the second insert
- **Both tiers must use the identical hash function.** Same algorithm, same normalization (strip query params, lowercase host, etc.)

### 1.5 Timestamp units

Everything in **milliseconds**. Instagrapi returns seconds — multiply by 1000 before returning. The link-preview API may return seconds or ISO strings — normalize to ms.

---

## 2. Backend Work (Paid Tier Only)

### 2.1 What the backend must do

**Exactly three things. Nothing else.**

1. **Auth** — verify the caller is a paid user (bearer token / subscription check)
2. **Fetch** — run `instagrapi` for that user's DMs, parse reel + sender text
3. **Return** — a `BookmarkResponse[]` matching the schema shape

### 2.2 What the backend must NOT do

- ❌ Store bookmarks (the frontend's SQLite does that)
- ❌ Call the public link-preview API (the DM payload already has everything)
- ❌ Manage UI state
- ❌ Sync across devices

### 2.3 The `/messages/links` response shape

Return **exactly** this for each bookmark:

```json
{
  "id": "<dm_message_id>",
  "url": "https://www.instagram.com/reel/Ddm7_DEMQwJ/",
  "urlHash": "<sha256 of url>",
  "domain": "instagram.com",
  "path": "/reel/Ddm7_DEMQwJ/",
  "shortcode": "Ddm7_DEMQwJ",
  "title": "",
  "description": "",
  "image": "<xma_share.preview_url>",
  "favicon": "https://instagram.com/favicon.ico",
  "siteName": "Instagram",
  "author": "<xma_share.header_title_text>",
  "publishedAt": null,
  "language": "",
  "type": "reel",
  "mediaType": "reel",
  "tags": ["pizza"],
  "notes": "",
  "isFavorite": false,
  "isArchived": false,
  "isRead": false,
  "customTitle": "",
  "customDescription": "this is my fab #pizza recipe",
  "username": "<dm_sender_username>",
  "timestamp": 1790200129000
}
```

### 2.4 Field-by-field source (paid tier)

| Field | Source |
|---|---|
| `url` | `xma_share.video_url` (strip `?...`) |
| `urlHash` | Compute server-side: `sha256(url)` |
| `domain` / `path` | Derive from `url` |
| `shortcode` | Regex on `url`: `instagram.com/reel/([^/?]+)` |
| `title` | `""` — Instagram provides none |
| `description` | `""` — reserved for auto metadata; sender text goes in `customDescription` |
| `image` | `xma_share.preview_url` |
| `favicon` | Hardcode `https://instagram.com/favicon.ico` |
| `siteName` | Hardcode `"Instagram"` |
| `author` | `xma_share.header_title_text` (the reel creator) |
| `publishedAt` | `null` unless you add `instagrapi.media_info()` |
| `language` | `""` |
| `type` | Map `media_type`: `reel`→`reel`, `igtv`→`video`, `post`→`image`, else `link` |
| `mediaType` | Raw `media_type` value |
| `tags` | `extract_tags(customDescription)` — **real JSON array in response** |
| `notes`, flags | Defaults (`""`, `false`) |
| `customTitle` | `""` |
| `customDescription` | The sender's typed sentence (merged from adjacent text messages) |
| `username` | DM sender's username |
| `timestamp` | `int(dm_message.timestamp.timestamp() * 1000)` |

### 2.5 The caption/description merging logic (critical)

The DM sender may type text near the reel. That text becomes `customDescription`. Rules:

1. **Inline text on the share message itself** (`message.text` when `item_type == "xma_clip"`) → use it
2. **Adjacent text message** from the **same sender** within `CAPTION_WINDOW_SECONDS` (recommend **120s**) → use it
3. **Swipe-reply** to the reel (`message.reply.replied_to_message_id` points at the reel) → use it
4. **Multiple text messages** in the window → concatenate with a space, don't drop any
5. Text messages claimed as captions must **not** appear as separate items in the output

### 2.6 Derive tags

```python
import re
_HASHTAG_RE = re.compile(r"#(\w+)", re.UNICODE)

def extract_tags(text: str | None) -> list[str]:
    if not text:
        return []
    seen, out = set(), []
    for t in _HASHTAG_RE.findall(text):
        t = t.lower()
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out
```

The response returns a **real array**. The client stringifies it on insert.

### 2.7 Backend endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/messages/links` | Return new DM bookmarks **and mark them consumed** |
| `GET` | `/messages` | Read-only peek (does not consume) |
| `GET` | `/messages/history?username=&limit=&type=` | Ad-hoc lookup, no state change |
| `POST` | `/debug/reset` | Clear seen state |
| `GET` | `/debug/raw?thread_index=&count=` | Inspect raw DM structure |

### 2.8 Backend checklist

- [ ] Session cached to `session.json`, reloaded on startup
- [ ] Credentials loaded from `.env` (`IG_USERNAME`, `IG_PASSWORD`)
- [ ] `_fetch_lock` prevents overlapping Instagram calls
- [ ] Returns `BookmarkResponse[]` with **all schema fields**
- [ ] `urlHash` computed server-side
- [ ] `tags` returned as a real JSON array (not a string)
- [ ] Timestamps in **milliseconds**
- [ ] Text fields are `""`, never `null`
- [ ] `customDescription` holds the sender's sentence
- [ ] `description` is `""` (reserved for auto metadata)
- [ ] No external link-preview API call anywhere in the DM flow
- [ ] `/messages/links` consumes; `/messages` and `/messages/history` do not

---

## 3. Frontend Work

### 3.1 The two save flows

**Free tier (no backend):**

```
User pastes URL
  → check DB by urlHash (skip if exists)
  → fetchExtractedMetadata(url)  // goes to public API
  → normalize to Bookmark shape
  → insert with onConflictDoNothing
```

**Paid tier (backend configured):**

```
GET /messages/links from backend
  → for each BookmarkResponse:
      → insert with onConflictDoNothing({ target: urlHash })
  → done
```

No external API call in the paid path. The backend already returned finished rows.

### 3.2 Required fixes in `utils/metadata.ts`

**Fix 1 — Update the comments to match the two-tier plan.**

Replace:
```ts
// Interim fallback: the public link-preview API...
```
With:
```ts
// Permanent extraction path for free-tier users (no backend configured).
// Not a fallback — this is the primary source when settings.serverUrl is empty.
```

**Fix 2 — Rename `ExtractSource`.**

```ts
export type ExtractSource = 'backend' | 'public';
```

Update `fetchExtractedMetadata` to set `'backend'` / `'public'` accordingly.

**Fix 3 — Add a DB-before-fetch check in the caller.**

Before calling `fetchExtractedMetadata`, query SQLite by `urlHash`. If a row exists, skip the network call entirely.

```ts
async function enrichOrFetch(url: string) {
  const hash = urlHashFor(url);
  const existing = await db.select().from(bookmarks)
    .where(eq(bookmarks.urlHash, hash)).get();
  if (existing) return existing;

  const result = await fetchExtractedMetadata(url);
  return result?.patch ?? fallbackPatch(url, hash);
}
```

**Fix 4 — Handle `null` from `fetchExtractedMetadata`.**

When both extractors fail, the caller must still save *something*:

```ts
function fallbackPatch(url: string, hash: string): Partial<NewBookmark> {
  const parsed = new URL(url);
  return {
    url, urlHash: hash,
    domain: parsed.hostname,
    path: parsed.pathname,
    title: parsed.hostname,   // show the domain as the title
    description: '', image: '', favicon: faviconForDomain(parsed.hostname),
    siteName: parsed.hostname, author: '',
    publishedAt: null, language: '', type: 'link',
  };
}
```

**Fix 5 — Check for dead code.**

`WALLED_HOSTS` and `isWalledDomain` were for skipping direct fetches on IG/TikTok/etc. If nothing calls `fetchPageMetadata()` directly anymore (because free tier always uses the public API), delete:
- `WALLED_HOSTS`, `isWalledDomain`
- `fetchPageMetadata`
- The HTML parsing helpers (`readMeta`, `readTitle`, `readHtmlLang`, `decodeEntities`, `META_TAG_RE`, `NAMED_ENTITIES`) — **unless** something else uses them

Verify with a search before deleting.

**Fix 6 — Confirm the public API returns what you need.**

Add a temporary `console.log(raw)` in `fetchMetadataFromAzizbecha` and inspect the full response. If it returns `author`, `publishedAt`, `language`, or `type`, map them. If it doesn't, accept that free-tier rows have those as defaults.

### 3.3 The insert function (shared by both tiers)

```ts
export async function insertBookmark(res: BookmarkResponse) {
  const now = Date.now();
  await db.insert(bookmarks).values({
    url: res.url,
    urlHash: res.urlHash,          // backend-provided for paid; computed for free
    domain: res.domain,
    path: res.path,
    title: res.title ?? '',
    description: res.description ?? '',
    image: res.image ?? '',
    favicon: res.favicon ?? '',
    siteName: res.siteName ?? '',
    author: res.author ?? '',
    publishedAt: res.publishedAt ?? null,
    language: res.language ?? '',
    type: res.type ?? 'link',
    tags: JSON.stringify(res.tags ?? []),   // array → JSON string
    notes: '',
    isFavorite: false, isArchived: false, isRead: false,
    customTitle: res.customTitle ?? '',
    customDescription: res.customDescription ?? '',
    createdAt: now, updatedAt: now,
    lastViewedAt: null, viewCount: 0,
  }).onConflictDoNothing({ target: bookmarks.urlHash });
}
```

**Every save — free or paid — goes through this one function.** That's the whole point.

### 3.4 The read side

```ts
const rows = await db.select().from(bookmarks);
const items = rows.map((r) => ({
  ...r,
  tags: parseTags(r.tags),
  effectiveTitle: r.customTitle || r.title,
  effectiveDescription: r.customDescription || r.description,
}));
```

---

## 4. Verification Checklist

Before declaring the work done, verify each of these:

### Schema / contract
- [ ] Every insert fills every `notNull` column
- [ ] Text fields are `""` not `null`
- [ ] `tags` is a JSON string in DB, array in API response and UI
- [ ] Timestamps are ms everywhere
- [ ] `urlHash` uses the same algorithm in free and paid paths

### Free tier
- [ ] Paste URL → DB checked first → API called only if new
- [ ] API failure produces a minimal but valid bookmark (url + domain as title)
- [ ] No backend required — works offline-first (network only for the API call)

### Paid tier
- [ ] Backend returns **all** schema fields per bookmark
- [ ] `customDescription` holds the sender's typed text (when present)
- [ ] `description` is `""` (not the sender's text)
- [ ] Adjacent text messages within 120s merge into `customDescription`
- [ ] Multiple text messages concatenate, don't drop
- [ ] Swipe-reply text attaches to the right reel
- [ ] Tags are extracted from `customDescription` and returned as an array
- [ ] No call to the public link-preview API anywhere in the paid path

### Both tiers
- [ ] Same reel saved via free *and* paid path dedups to one row
- [ ] UI renders a row identically regardless of which tier produced it
- [ ] `effective = customX || X` is applied on read

### Backend safety
- [ ] `/messages/links` consumes; `/messages` does not
- [ ] `_fetch_lock` prevents concurrent IG calls
- [ ] Session file exists and reloads on startup
- [ ] `.env` credentials are not committed

---

## 5. Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|---|---|
| Write the sender's typed text into `description` | Put it in `customDescription` |
| Return `tags` as a string from the backend | Return a real array; stringify on insert |
| Call the public link-preview API in the paid path | Use the DM payload directly |
| Use `null` for text columns | Use `""` |
| Use seconds for timestamps | Use milliseconds |
| Let free and paid paths produce different shapes | One `insertBookmark()` for both |
| Call the API before checking the DB | Check `urlHash` first |
| Delete `WALLED_HOSTS` without checking callers | Search first, then delete |
| Skip the fallback when the API fails | Return a minimal patch so the save succeeds |

---

## 6. Order of Operations

Build in this order so each step is testable:

1. **Schema** — already done. Freeze it. Don't change column names after this.
2. **`insertBookmark()`** — one function, both tiers.
3. **Free tier end-to-end** — paste URL → API → insert → render. Ship it.
4. **Backend `/messages/links`** — return the exact shape, hardcoded test data first.
5. **Backend instagrapi integration** — real DM fetch, real parse.
6. **Paid tier wiring** — frontend calls backend, inserts via the same `insertBookmark()`.
7. **Dedup test** — save the same reel both ways, verify one row.

Steps 1–3 give you a shippable free app. Steps 4–7 add the paid tier without touching the free path.

---

That's the full guide. The core principle throughout: **one row shape, one insert function, two sources of metadata.** Every check above exists to enforce that. If the agent follows this, both tiers will interoperate cleanly and the schema won't need to change.

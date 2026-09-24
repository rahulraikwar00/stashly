# 1. Product Requirements (PRD)

Plain-language essentials. Not a legal document — a shared understanding of what we're building.

## 1.1 Problem

People save links and Instagram reels to "read/watch later" all the time, but those saves get scattered (screenshots, notes, message threads) and are hard to find again. This app collects them in one tidy, searchable library that lives on your phone.

## 1.2 Who it's for

A single user saving their own links and reels. No teams, no sharing, no accounts (yet). One phone = one library.

## 1.3 What the app does

**Saving (two ways, same result):**

- **Free path:** user pastes any URL → the app fetches a title + thumbnail from a public link-preview service and saves the bookmark. Works with no backend at all.
- **Connected path (the "paid" idea):** user sends reels/posts to their own Instagram via DM → the backend (a small FastAPI service that logs into Instagram) reads the DMs and returns new links → the app saves them, including the captions the user typed next to the reel.

**Library:**

- Browse saved bookmarks as a board of cards (image, title, favicon).
- Search by text, filter by type/status/tag, sort (newest, oldest, unread, favorites).
- Each bookmark: mark favorite / read / archived, edit title/description/notes, add tags, copy link, share out, open the original page, delete.
- Tap a tag → filter the board by it.

**Data safety:**

- Everything is stored locally (SQLite). No account needed.
- Export your whole library as a JSON file; import it back (restore) anytime.
- Same link saved twice → only one bookmark (dedup).

## 1.4 Must-have vs nice-to-have

**Must-have (MVP is essentially built):**

- Paste-URL save with auto title/image (falls back gracefully when a page yields nothing).
- The library board: grid, search, filters, sort.
- Per-bookmark actions: favorite, read, archive, edit, tags, delete.
- Local-only storage + JSON backup.
- Safe handling of a missing/private link (still saves a minimal card).

**Connected tier (the assisted path — partially built):**

- Backend logs into Instagram and returns new DM links on demand.
- Captions and hashtags from the DM become the bookmark's notes/tags automatically.
- The app calls the backend, saves the new bookmarks, and shows the result to the user.

**Nice-to-have (next, not now):**

- Sync library across devices / Chrome extension.
- Accounts & login.
- Reading mode / notes.

## 1.5 Out of scope (for now)

- Team/shared libraries, social features.
- Live video playback in-app (links open the original app).
- Realtime/hosted sync.
- A "real" store billing flow for the paid tier.

## 1.6 Rules that must always be true (the "contract")

These are non-negotiable because they keep the app working. Detailed in Architecture + API docs.

1. **One row shape.** Paste-save and DM-save produce the same kind of bookmark row. They never diverge.
2. **Dedup key = hash of the URL.** Two exact same URLs → one bookmark.
3. **User text vs auto text are separate.** `description`/`title` = auto-fetched metadata; the user's own words go in `customTitle`/`customDescription`/`notes` and win on display.
4. **Times are milliseconds.** Text fields are empty strings (`""`), never `null`. Tags are stored as a JSON string.
5. **Offline-first.** The library always works without internet; the network is only used to enrich or to fetch DMs.

## 1.7 Success looks like

- A link pasted in 30 seconds shows up in the board with a good title and image.
- DM the same reel 3 times → still exactly one bookmark.
- App reinstalled → backup file restores the whole library.
- The board stays smooth to scroll even with hundreds of bookmarks.

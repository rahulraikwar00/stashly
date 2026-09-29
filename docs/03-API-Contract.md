# 3. API Contract

Who talks to whom, in plain words, and what exactly they say.

## 3.1 Actors

- **App** → **Backend**: "give me my new Instagram DMs" (`/messages/links`) and "extract this page's metadata" (`/metadata`, when restored).
- **App** → **Public link-preview API**: free-tier title/image fetch (called `azizbecha` in code).
- **Backend** → **Instagram**: instagrapi (unofficial private API). Backend must never expose Instagram's data to anyone other than the configured account.

## 3.2 Backend endpoints (FastAPI)

"Code" auth = the 6-digit link code from the Instagram flow, sent as
`X-API-Key: <code>` or `Authorization: Bearer <code>`. The code is your identity:
each code is bound (via `/link <code>` in DMs to the official account) to exactly
one thread, so every caller only ever sees their own thread.

| Method | Path                                    | Auth   | Purpose                                    | Consumes ("seen") state? |
| ------ | --------------------------------------- | ------ | ------------------------------------------ | ------------------------ |
| GET    | `/health`                               | open   | am I alive?                                | no                       |
| POST   | `/auth/codes`                           | open   | register a pending 6-digit code            | —                        |
| GET    | `/auth/status`                          | code   | is my code linked? which thread/account?   | no                       |
| POST   | `/auth/unlink`                          | code   | forget / revoke the code + free the thread | no                       |
| GET    | `/messages`                             | code   | peek my thread (read-only)                 | no                       |
| GET    | `/messages/links`                       | code   | **get new links** (the app's real call)    | **yes**                  |
| GET    | `/messages/history?username&limit&type` | code   | look up old items in my thread             | no                       |
| POST   | `/debug/reset`                          | code   | clear the "seen" marker for my thread      | resets it                |
| GET    | `/debug/raw`                            | code   | inspect raw DM shape (debug)               | no                       |
| GET    | `/metadata?url&timeout_ms&debug`        | open   | extract a page's og:title/image            | —                        |

"Consumes" matters: once `/messages/links` returns a link, it won't be returned again — the backend remembers what you've already seen in `seen_messages.json` (keyed per thread, so it's isolated per code/user). `/messages`, `/messages/history` and `/auth/status` never change that memory, so browsing is safe.

Unregistered DMs to the official account are read only to detect `/link <code>` directives; everything else is ignored — never relayed, never persisted, never advances seen-state.

## 3.3 What "new links" look like (target, per spec)

Each item should be a full, ready-to-save bookmark:

```json
{
  "url": "https://www.instagram.com/reel/Ddm7_DEMQwJ/",
  "urlHash": "<djb2-of-url>",
  "domain": "instagram.com",
  "path": "/reel/Ddm7_DEMQwJ/",
  "shortcode": "Ddm7_DEMQwJ",
  "title": "",
  "description": "",
  "image": "<preview-url>",
  "favicon": "https://instagram.com/favicon.ico",
  "siteName": "Instagram",
  "author": "<reel-creator>",
  "publishedAt": null,
  "language": "",
  "type": "video",
  "mediaType": "reel",
  "tags": ["pizza"],
  "notes": "",
  "isFavorite": false,
  "isArchived": false,
  "isRead": false,
  "customTitle": "",
  "customDescription": "this is my fab #pizza recipe",
  "username": "<dm-sender>",
  "timestamp": 1790200129000
}
```

**What it currently returns (live code):** the shape above is live — the backend (D-016) returns every field. `urlHash` uses the app's **djb2** function (ported), `type` is app-aligned (`video`/`image`/`link`), timestamps are **ms**, sender text lands in `customDescription` (never `description`), and `tags` is a real JSON array.

## 3.4 Rules the app and backend both honor

| Rule                                 | Meaning                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Millisecond times                    | All timestamps are `epoch ms`. Instagram gives seconds → backend multiplies by 1000.                                |
| `""` not `null`                      | Text fields are empty strings, never `null`.                                                                        |
| `tags` is a real array "on the wire" | Backend returns `["pizza"]`; the app stores it as a JSON string on insert.                                          |
| `urlHash` = djb2 of the URL          | Same function on both sides (`utils/hash.ts` `urlHashFor`; backend ports it); same URL → same hash → one bookmark.  |
| User words in `customDescription`    | Never write the sender's caption into `description` (that's for auto metadata).                                     |
| Backend does the caption-merge       | A text DM near a link (same sender, ≤120s) becomes that link's caption; claimed texts are not returned as their own items; multiple texts concatenate. |
| No nested calls                      | The paid/DM path never calls the public link-preview API.                                                           |
| Auth = your link code                | DM + debug endpoints require the 6-digit code (`X-API-Key` / Bearer); unlinked codes 401; unregistered DMs are never relayed. |

## 3.5 Error handling (app side)

- Every fetch has a timeout (~12s) and aborts cleanly; a failure returns `null`, not a crash.
- The app surfaces friendly messages ("Could not fetch details — saved with domain only").
- Network problems on manual save → treated as grade-to-user; library keeps working offline.

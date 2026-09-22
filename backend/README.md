# Metadata extractor

Tiny FastAPI service that the Expo app calls to enrich bookmarks when a direct
device-side fetch returns no metadata (walled platforms like Instagram/TikTok).

It does NOT use a headless browser. The trick is the crawler User-Agent: sites
like Instagram serve full `og:` meta tags to crawler UAs (`Googlebot`,
`facebookexternalhit`) but a consent/JS shell to browser-like UAs.

## Run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Test

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/metadata?url=https%3A%2F%2Fwww.instagram.com%2Freel%2FDdjqhjPhkm7%2F"
```

The second call returns the reel caption as `title`, likes/comments as
`description`, and the thumbnail as `image`.

Each request prints a one-line structured log to stdout, e.g.:

```
INFO [metadata-extractor] url=https://www.instagram.com/reel/... status=ok host=www.instagram.com ua=Googlebot/2.1 ... elapsed=1840.2ms title=1 description=1 image=1
```

For more per-request detail (elapsed time, chosen user-agent, which fields were
found), add `debug=1`:

```bash
curl "http://localhost:8000/metadata?url=https%3A%2F%2Fwww.instagram.com%2Freel%2FDdjqhjPhkm7%2F&debug=1"
```

## Deployment

Point the app at your deployed instance with the env var:

```
EXPO_PUBLIC_METADATA_EXTRACTOR_URL=https://your-host/metadata
```

In an Expo dev build the app auto-derives `http://<dev-machine-ip>:8000`, so a
server running on port 8000 on the dev machine is picked up automatically. If
you need to pin it (e.g. the server runs on another machine in your LAN), set
the env var in the app's `.env` file, then restart the dev server.

## App-side debugging

The app records an in-memory event log for every enrichment (tier chosen,
extractor URL, failure reasons, elapsed time) and the "Saved to your library"
screen shows a live status chip with a colored dot — green = loaded, amber =
served by the interim fallback API, red = no details. Console logging is
enabled in dev builds by default; for release builds opt in with:

```
EXPO_PUBLIC_DEBUG_LOGS=1
```

## Safety

`guards.py` validates the URL (http/https only) and rejects hosts that resolve
to private/reserved addresses (basic SSRF protection against the cloud metadata
endpoint and internal services).
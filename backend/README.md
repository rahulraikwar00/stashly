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

## Deployment

Point the app at your deployed instance with the env var:

```
EXPO_PUBLIC_METADATA_EXTRACTOR_URL=https://your-host/metadata
```

In an Expo dev build the app auto-derives `http://<dev-machine-ip>:8000`, so a
server running on port 8000 on the dev machine is picked up automatically.

## Safety

`guards.py` validates the URL (http/https only) and rejects hosts that resolve
to private/reserved addresses (basic SSRF protection against the cloud metadata
endpoint and internal services).
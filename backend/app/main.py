import logging
import time
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .extract import _user_agent_for, extract_metadata
from .guards import validate_public_url

logger = logging.getLogger("metadata-extractor")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s [metadata-extractor] %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

app = FastAPI(title="Metadata extractor", version="1.1.0")

# The mobile app fetches this over the network; CORS only matters for web dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": 200, "statusText": "API is running"}


def _log_request(started: float, url: str, status: str, result: dict | None = None) -> None:
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    logger.info(
        "url=%s status=%s host=%s ua=%s elapsed=%sms title=%s description=%s image=%s",
        url,
        status,
        urlsplit(url).hostname or "?",
        _user_agent_for(url),
        elapsed_ms,
        bool(result and result.get("title")),
        bool(result and result.get("description")),
        bool(result and result.get("image")),
    )


@app.get("/metadata")
def metadata(
    url: str = Query(...),
    timeout_ms: int = Query(12000, ge=1000, le=20000),
    debug: bool = Query(False),
) -> dict:
    """Extract page metadata for an arbitrary public http(s) URL.

    Pass `debug=1` to include a `trace` object with diagnostics (elapsed time,
    chosen user-agent, which fields were found).
    """
    target = validate_public_url(url)
    started = time.perf_counter()
    try:
        result = extract_metadata(target, timeout_ms=timeout_ms)
    except httpx.TimeoutException as exc:
        _log_request(started, url, "timeout")
        raise HTTPException(status_code=504, detail=f"Upstream timed out: {url}") from exc
    except httpx.HTTPStatusError as exc:
        _log_request(started, url, f"upstream-{exc.response.status_code}")
        raise HTTPException(
            status_code=502, detail=f"Upstream responded with status {exc.response.status_code}: {url}"
        ) from exc
    except httpx.RequestError as exc:
        _log_request(started, url, "request-error")
        raise HTTPException(status_code=502, detail=f"Upstream request failed: {exc}") from exc

    _log_request(started, url, "ok", result)
    if debug:
        result["trace"] = {
            "elapsedMs": round((time.perf_counter() - started) * 1000, 1),
            "userAgent": _user_agent_for(target),
            "host": urlsplit(target).hostname or "",
            "titlePresent": bool(result.get("title")),
            "descriptionPresent": bool(result.get("description")),
            "imagePresent": bool(result.get("image")),
            "canonicalUrl": result.get("canonicalUrl") or "",
        }
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
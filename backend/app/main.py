import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .extract import extract_metadata
from .guards import validate_public_url

app = FastAPI(title="Metadata extractor", version="1.0.0")

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


@app.get("/metadata")
def metadata(
    url: str = Query(...),
    timeout_ms: int = Query(12000, ge=1000, le=20000),
) -> dict:
    """Extract page metadata for an arbitrary public http(s) URL."""
    target = validate_public_url(url)
    try:
        return extract_metadata(target, timeout_ms=timeout_ms)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail=f"Upstream timed out: {url}") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502, detail=f"Upstream responded with status {exc.response.status_code}: {url}"
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream request failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
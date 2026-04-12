# TODO-012 [P2] CORS Allows All Methods/Headers, Stale HTTP Origins

## Status: Pending

## Problem

CORS middleware in `main.py` uses `allow_methods=["*"]` and `allow_headers=["*"]`, which is overly permissive. Additionally, HTTP origins (non-HTTPS) may still be in the allowlist in `backend/src/app/config/environment.py` even though production runs HTTPS.

## Affected Files

- `backend/src/app/main.py:36-42` — `allow_methods=["*"]` and `allow_headers=["*"]`
- `backend/src/app/config/environment.py:4-12` — `CORS_ORIGINS` includes HTTP origins and old IP `147.224.154.73`

## Fix

Restrict methods and headers to what's actually used:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # audit this list
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    allow_credentials=True,
)
```

Remove any `http://` origins from `CORS_ORIGINS` if only HTTPS is used in production.

## Impact

- **Severity:** Expanded attack surface for CSRF-like attacks
- **Fix complexity:** Very low — config change

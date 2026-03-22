---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, security, backend, cors]
dependencies: []
---

# CORS Configured with allow_methods=["*"] and allow_headers=["*"]

## Problem Statement

CORS is configured with `allow_methods=["*"]` and `allow_headers=["*"]`. The API only uses GET and POST. The broad configuration increases attack surface if any future misconfiguration widens the origin list.

Additionally, HTTP origins and the raw production IP are still in `CORS_ORIGINS` despite HTTPS being deployed.

## Findings

- File: `backend/src/app/main.py` lines 36–42
- File: `backend/src/app/config/environment.py`
- `allow_methods=["*"]` permits DELETE, PUT, PATCH, OPTIONS unnecessarily
- `allow_headers=["*"]` with `allow_credentials=True` is overly permissive
- `http://jduel.com`, `http://www.jduel.com`, and `http://147.224.154.73` in CORS_ORIGINS are stale after HTTPS migration

## Proposed Solution

```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# environment.py — remove HTTP origins and raw IP
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://jduel.com",
    "https://www.jduel.com",
]
```

## Acceptance Criteria
- [ ] `allow_methods` restricted to `["GET", "POST", "OPTIONS"]`
- [ ] `allow_headers` restricted to `["Content-Type", "Authorization"]`
- [ ] HTTP production origins removed from CORS_ORIGINS
- [ ] Raw IP `147.224.154.73` removed from CORS_ORIGINS
- [ ] Localhost entries retained for local development

## Work Log
- 2026-03-22: Identified by `security-sentinel` review agent

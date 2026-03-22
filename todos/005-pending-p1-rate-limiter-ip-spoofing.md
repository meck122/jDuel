---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, security, backend, rate-limiting]
dependencies: []
---

# Rate Limiter Bypassed via X-Forwarded-For IP Spoofing

## Problem Statement

`get_client_ip()` reads the first value from the `X-Forwarded-For` header as the authoritative client IP. An attacker can trivially send `X-Forwarded-For: 1.2.3.4` and rotate through arbitrary fake IPs, bypassing all per-IP rate limits on `/api/rooms` (5 req/min) and `/api/rooms/:id/join` (20 req/min).

**Why it matters:** An attacker can create unbounded rooms (memory exhaustion, room-squatting) or perform unlimited join attempts (name bruteforce, session token guessing) by cycling fake IP values in the header.

## Findings

- File: `backend/src/app/api/dependencies.py` lines 37–43
- nginx sets `proxy_add_x_forwarded_for` which **appends** the real IP — so the real IP is the **last** value, not the first
- The current code trusts the attacker-controlled leading entry
- Since this is a single-hop nginx deployment (`127.0.0.1:8000`), `request.client.host` is always `127.0.0.1` (nginx loopback)
- nginx sets `X-Real-IP` to the actual client IP, and clients cannot spoof it (nginx controls this header)

## Proposed Solutions

### Option A: Use X-Real-IP instead of X-Forwarded-For (Recommended)
- nginx config already has (or should confirm) `proxy_set_header X-Real-IP $remote_addr;`
- Change `get_client_ip()` to: `return request.headers.get("X-Real-IP", request.client.host)`
- **Pros:** Correct for this single-hop topology; clients cannot forge `X-Real-IP`.
- **Cons:** Breaks if nginx config doesn't set `X-Real-IP` (verify first).
- **Effort:** Small | **Risk:** Low

### Option B: FastAPI ProxyHeadersMiddleware with trusted proxy list
- Add `app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["127.0.0.1"])` in `main.py`
- FastAPI's middleware correctly extracts real IP from `X-Forwarded-For` when proxy is trusted
- **Pros:** Standard FastAPI pattern; portable if topology changes.
- **Cons:** Slightly more setup.
- **Effort:** Small | **Risk:** Low

### Option C: If X-Forwarded-For is used, take the LAST entry
- The last entry in `X-Forwarded-For` is the one added by the nearest trusted proxy (nginx)
- `ips = request.headers.get("X-Forwarded-For", "").split(","); real_ip = ips[-1].strip()`
- **Pros:** Works without nginx config changes.
- **Cons:** Fragile if multiple proxies are added later.
- **Effort:** Small | **Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details
- Affected file: `backend/src/app/api/dependencies.py`
- Also verify `deploy/nginx/jduel` has `proxy_set_header X-Real-IP $remote_addr;`

## Acceptance Criteria
- [ ] `get_client_ip()` returns the actual client IP, not an attacker-controlled header value
- [ ] Sending `X-Forwarded-For: 1.2.3.4` does not bypass rate limiting
- [ ] Verified against the nginx config to confirm the IP source is correct

## Work Log
- 2026-03-22: Identified by `security-sentinel` review agent

## Resources
- `backend/src/app/api/dependencies.py`
- `deploy/nginx/jduel`

---
date: 2026-04-12
topic: security-vulnerabilities
focus: Security vulnerabilities in the app and things committed to the public GitHub repo that could be concerning
---

# Ideation: Security Vulnerabilities & Public Repo Hygiene

## Codebase Context

- React 19 + Vite + MUI v7 frontend, FastAPI + Python 3.13 backend
- Real-time multiplayer trivia via WebSocket; HTTP for room management
- No database for game state (in-memory); `questions.db` SQLite gitignored
- Production: Oracle Cloud aarch64 VM (4 GB RAM), systemd + nginx, no Docker
- NLP answer verification (spaCy + sentence-transformers), CPU-only
- 25 pre-catalogued security/reliability issues in `docs/todos/` from a 2026-03-27 code review

**Confirmed clean (no action needed):**
- `deploy/alloy/config.alloy` — credentials loaded via `env()` from `/etc/alloy/env`, nothing hardcoded
- `questions.db` — gitignored via `*.db` rule, not in the public repo
- `.coverage` — gitignored, not in the public repo
- Room codes — already use `secrets.choice()` (not `random`)
- `ProxyHeadersMiddleware` — already wired in `main.py` with `trusted_hosts=["127.0.0.1"]`

## Ranked Ideas

### 1. Non-cryptographic room codes → secrets.choice()
**Description:** `room_repository.py` used `random.choices()` (Mersenne Twister). With only 1.7M possible 4-char codes and no effective rate limiting, active rooms are enumerable in minutes.
**Rationale:** One-line fix with zero risk. Eliminates room enumeration. Highest ROI security fix.
**Downsides:** None.
**Confidence:** 98%
**Complexity:** Low
**Status:** Resolved — already uses `secrets.choice()` in the codebase

---

### 2. Rate limiter IP spoofing via X-Forwarded-For
**Description:** `dependencies.py:28-43` trusted the raw `X-Forwarded-For` header from clients, making all rate limits fully bypassable. Fix: `ProxyHeadersMiddleware(trusted_hosts=["127.0.0.1"])`.
**Rationale:** Without this, every rate limit in the app is decorative.
**Downsides:** Wrong config could block legitimate traffic. Must be tested.
**Confidence:** 95%
**Complexity:** Low
**Status:** Resolved — `ProxyHeadersMiddleware` already wired in `main.py`

---

### 3. Session token not validated at WebSocket connection
**Description:** The HTTP join endpoint generates `session_token = secrets.token_urlsafe(32)` and stores it in `room.session_tokens`, but `websocket_handler.py:21-67` never checks it. Anyone who learns a valid `(roomId, playerId)` pair can hijack that player's WebSocket slot.
**Rationale:** The hard part (token generation + storage) is done. The WS gate just needs to validate it. Closes a real player impersonation vector.
**Downsides:** Breaking change to the WS URL — requires coordinated frontend (`GameContext.tsx`) + backend update.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored — needs brainstorm

---

### 4. CORS over-permissive with stale IP origin
**Description:** `config/environment.py` included `http://147.224.154.73` (old AWS IP), HTTP variants of the production domain, and `allow_methods=["*"]`/`allow_headers=["*"]`. Stale IP is a risk if Oracle Cloud recycles it to another tenant.
**Rationale:** Pure config change, no user impact. Removed stale IP + HTTP origins; narrowed to `["GET", "POST"]` / `["Content-Type"]`.
**Downsides:** None.
**Confidence:** 85%
**Complexity:** Low
**Status:** Resolved in PR — `environment.py` and `main.py` updated

---

### 5. Nginx missing security headers
**Description:** Production nginx config had no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy. App renders player-supplied names/answers in the UI.
**Rationale:** Pure nginx config change. Prevents clickjacking, MIME-sniffing, SSL stripping. `unsafe-inline` required for MUI/emotion.
**Downsides:** CSP `unsafe-inline` weakens script injection protection. Certbot-generated HTTPS block requires manual header copy-over.
**Confidence:** 92%
**Complexity:** Low
**Status:** Resolved in PR — `deploy/nginx/jduel` updated

---

### 6. Correct answers leaked to Grafana Loki via INFO logs
**Description:** `answer_service.py:137-143` logs `correct_answer` at INFO level. Via Grafana Alloy, answers are now permanently stored in Grafana Cloud Loki — accessible to anyone with those credentials.
**Rationale:** One-line fix per log call (INFO → DEBUG or omit answer text). Amplified by the new Loki pipeline added in the metrics PR.
**Downsides:** Lose answer-checking diagnostics at INFO unless a structured outcome-only log is added.
**Confidence:** 88%
**Complexity:** Low
**Status:** Deferred — excluded from this ideation cycle by user

---

### 7. Adversarial Unicode input to NLP pipeline
**Description:** `AnswerMessage` validates only `max_length`. Crafted inputs (bidi control chars, combining-mark sequences) can cause pathological CPU-bound inference on the CPU-only sentence-transformer pipeline, blocking asyncio timers for seconds on the 4 GB Oracle VPS.
**Rationale:** Novel finding not in the existing todos. A lightweight regex pre-filter in the Pydantic validator eliminates this class of DoS before it reaches the NLP stack.
**Downsides:** Over-aggressive filtering could reject legitimate Unicode answers. Needs a carefully scoped allowlist.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored — needs brainstorm

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Alloy config has hardcoded credentials | False alarm — uses `env()` for all secrets |
| 2 | questions.db committed to repo | False alarm — gitignored via `*.db` rule |
| 3 | .coverage committed to repo | False alarm — gitignored |
| 4 | No global room/player cap | Availability/DoS concern, not a security vulnerability; well-documented in todos |
| 5 | Event loop blocking (NLP/SQLite) | Performance/reliability, not security |
| 6 | No asyncio lock on room state | Concurrency correctness, not a security vulnerability |
| 7 | TOCTOU race in player registration | Real but extremely narrow attack window; lower value than other fixes |
| 8 | Broadcast dict mutated during iteration | Reliability bug, not a security vulnerability |
| 9 | UPDATE_CONFIG untyped dict | Latent risk only; currently safe; already documented in todos |
| 10 | questions.db runtime integrity check | Speculative future attack; too expensive for current threat model |
| 11 | CORS config requires env-var override | Second-order concern; stale origins are the real issue (fixed directly) |
| 12 | Rate limiter drops vs closes connection | Marginal improvement; root issue was bypassable limiter (already fixed) |

## Session Log
- 2026-04-12: Initial ideation — ~20 candidates generated, 7 survivors. Items 1, 2 found already fixed in codebase. Items 4, 5 implemented in PR. Item 6 deferred by user. Items 3, 7 flagged for brainstorm.

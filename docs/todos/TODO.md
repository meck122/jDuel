# jDuel — Issue Tracker

Generated from code review findings in `docs/issues.md` (2026-03-27).

## Priority Guide

- **P1 (Critical):** Must fix — security, stability, or data integrity risks
- **P2 (Important):** Should fix — correctness, performance, or architecture issues
- **P3 (Nice to Have):** Enhancements and code quality improvements

---

## P1 — Critical (8 issues)

| # | Todo | Status | Complexity |
|---|------|--------|------------|
| [001](001-p1-event-loop-blocking-nlp.md) | NLP model.encode() blocks asyncio event loop | Pending | Medium |
| [002](002-p1-no-asyncio-lock-room-state.md) | No asyncio.Lock on room state mutations | Pending | Medium |
| [003](003-p1-unguarded-json-parse-websocket.md) | Unguarded JSON.parse in WS onmessage | Pending | Low |
| [004](004-p1-unbounded-websocket-message-size.md) | No WS payload size limit — OOM risk | Pending | Low |
| [005](005-p1-rate-limiter-ip-spoofing.md) | X-Forwarded-For spoofing bypasses rate limits | Pending | Low |
| [006](006-p1-no-global-room-player-cap.md) | No room/player caps — memory exhaustion DoS | Pending | Low |
| [007](007-p1-rate-limiter-cleanup-never-called.md) | Rate limiter cleanup never scheduled | Pending | Low |
| [008](008-p1-non-cryptographic-room-codes.md) | Room codes use random.choices, not secrets | Pending | Very Low |

### Recommended Fix Order

1. **008** (1 line) → **003** (try/catch) → **004** (uvicorn config) — quick wins
2. **005** + **006** + **007** — DoS triad, all low complexity
3. **001** — event loop blocking, most impactful but needs async refactor
4. **002** — asyncio locks, do alongside 001

---

## P2 — Important (13 issues)

| # | Todo | Status | Complexity |
|---|------|--------|------------|
| [009](009-p2-broadcast-dict-mutation-during-iteration.md) | broadcast() dict mutation during iteration | Pending | Low |
| [010](010-p2-session-token-not-validated-at-websocket.md) | No session token validation at WS gate | Pending | Medium |
| [011](011-p2-nginx-missing-security-headers.md) | Nginx missing security headers | Pending | Low |
| [012](012-p2-cors-all-methods-headers.md) | CORS too permissive, stale HTTP origins | Pending | Very Low |
| [013](013-p2-answers-logged-at-info-level.md) | Correct answers leaked in INFO logs | Pending | Very Low |
| [014](014-p2-no-pre-registration-ttl.md) | No TTL on HTTP pre-registrations | Pending | Low |
| [015](015-p2-room-closed-full-page-reload.md) | ROOM_CLOSED causes full page reload | Pending | Low |
| [016](016-p2-statebuilder-mutates-shuffled-options.md) | StateBuilder mutates options during broadcast | Pending | Very Low |
| [017](017-p2-difficulty-typed-as-string.md) | Difficulty typed as string not union | Pending | Low |
| [018](018-p2-gamecontext-value-recreated-every-render.md) | GameContext value recreated every render | Pending | Low |
| [019](019-p2-orchestrator-mutates-identity-fields.md) | Orchestrator mutates Room identity fields | Pending | Medium |
| [020](020-p2-toctou-player-registration-race.md) | TOCTOU race in player registration | Pending | Low |
| [021](021-p2-gameprovider-stale-state-across-sessions.md) | GameProvider stale state across sessions | Pending | Low-Medium |

---

## P3 — Nice to Have (4 issues)

| # | Todo | Status | Complexity |
|---|------|--------|------------|
| [022](022-p3-timer-dict-entries-not-cleaned.md) | Timer dict entries not cleaned after expiry | Pending | Very Low |
| [023](023-p3-mixed-enum-string-comparisons.md) | Mixed enum/string comparisons in orchestrator | Pending | Very Low |
| [024](024-p3-homepage-inaccessible-clickable-divs.md) | Homepage clickable divs not accessible | Pending | Low |
| [025](025-p3-update-config-accepts-untyped-dict.md) | UPDATE_CONFIG accepts untyped dict | Pending | Low-Medium |

---

## Related Skills

Use these skills when working on fixes:

- `ws-message-checklist` — for WS message changes (010, 025)
- `host-config-pattern` — for config validation (025)
- `type-system-alignment` — for type fixes (017)
- `testing-patterns` — for writing tests for any fix
- `debugging-backend` — for tracing state issues (002, 016, 019, 020)
- `deployment` — for nginx/production changes (005, 011)

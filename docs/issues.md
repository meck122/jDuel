  ---
  ✅ Code Review Complete

  Review Target: Full repository — jDuel (FastAPI + React WebSocket trivia game)

  ---
  Findings Summary

  - Total Findings: 25 (after deduplication across 7 agents)
  - 🔴 CRITICAL (P1): 8 — Must fix
  - 🟡 IMPORTANT (P2): 13 — Should fix
  - 🔵 NICE-TO-HAVE (P3): 4 — Enhancements
```
  ---
  🔴 P1 — Critical (Must Fix)

  ┌─────┬─────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
  │  #  │                        Todo                         │                            Issue                            │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 001 │ 001-pending-p1-event-loop-blocking-nlp-sqlite.md    │ NLP model.encode() + SQLite block asyncio event loop —      │
  │     │                                                     │ freezes all WebSocket connections per answer                │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 002 │ 002-pending-p1-no-asyncio-lock-room-state.md        │ No asyncio.Lock on room state — double state transitions    │
  │     │                                                     │ possible under concurrency                                  │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 003 │ 003-pending-p1-unguarded-json-parse-websocket.md    │ Unguarded JSON.parse in ws.onmessage — can silently freeze  │
  │     │                                                     │ the frontend UI                                             │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 004 │ 004-pending-p1-unbounded-websocket-message-size.md  │ No WS payload size limit — single player can OOM the server │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 005 │ 005-pending-p1-rate-limiter-ip-spoofing.md          │ X-Forwarded-For IP spoofing bypasses all rate limits        │
  │     │                                                     │ entirely                                                    │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 006 │ 006-pending-p1-no-global-room-player-cap.md         │ No global room cap or per-room player cap — memory          │
  │     │                                                     │ exhaustion DoS                                              │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 007 │ 007-pending-p1-rate-limiter-cleanup-never-called.md │ Rate limiter bucket cleanup never scheduled — unbounded     │
  │     │                                                     │ memory growth                                               │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 008 │ 008-pending-p1-non-cryptographic-room-codes.md      │ Room codes use random.choices (not secrets) — only 1.7M     │
  │     │                                                     │ possible codes, enumerable                                  │
  └─────┴─────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘

  ---
  🟡 P2 — Important (Should Fix)

  ┌─────┬───────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────┐
  │  #  │                   Todo                    │                                 Issue                                 │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 009 │ broadcast-dict-mutation-during-iteration  │ broadcast() iterates dict without snapshot; slow client stalls all    │
  │     │                                           │ others                                                                │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 010 │ session-token-not-validated-at-websocket  │ Session token not checked at WS gate — slot hijacking possible        │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 011 │ nginx-missing-security-headers            │ No X-Frame-Options, CSP, HSTS, nosniff, Referrer-Policy               │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 012 │ cors-all-methods-headers                  │ CORS allows all methods/headers; HTTP origins still in allowlist      │
  │     │                                           │ post-HTTPS                                                            │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 013 │ answers-logged-at-info-level              │ Correct answers logged at INFO — leaked in journalctl                 │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 014 │ no-pre-registration-ttl                   │ No TTL on HTTP pre-registrations — name slot squatting possible       │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 015 │ window-location-replace-bypasses-router   │ ROOM_CLOSED causes full page reload instead of React Router           │
  │     │                                           │ navigation                                                            │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 016 │ statebuilder-mutates-room-as-side-effect  │ StateBuilder mutates shuffled_options during a read-only state        │
  │     │                                           │ broadcast                                                             │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 017 │ difficulty-typed-as-string-not-union      │ difficulty typed as string not "enjoyer" | "master" | "beast" union   │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 018 │ gamecontext-value-recreated-every-render  │ GameContext value recreated on every render — all consumers re-render │
  │     │                                           │  per broadcast                                                        │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 019 │ handle-play-again-mutates-identity-fields │ Orchestrator directly mutates identity-layer Room fields, breaking    │
  │     │                                           │ service boundary                                                      │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 020 │ toctou-player-registration-race           │ TOCTOU race in sync HTTP handler thread pool on player registration   │
  ├─────┼───────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ 021 │ gameprovider-stale-state-across-sessions  │ GameProvider above Router allows stale roomState to leak into         │
  │     │                                           │ HomePage                                                              │
  └─────┴───────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────┘

  ---
  🔵 P3 — Nice to Have

  ┌─────┬─────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
  │  #  │                        Todo                         │                            Issue                            │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 022 │ timer-dict-entries-not-cleaned-after-natural-expiry │ Completed timer tasks orphaned in dict after room deletion  │
  │     │                                                     │ edge case                                                   │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 023 │ mixed-enum-string-comparisons-orchestrator          │ 3 locations use .value string comparison instead of         │
  │     │                                                     │ GameStatus enum                                             │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 024 │ homepage-inaccessible-clickable-divs                │ Home page cards are <div onClick> — not keyboard or         │
  │     │                                                     │ screen-reader accessible                                    │
  ├─────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
  │ 025 │ update-config-accepts-untyped-dict                  │ UPDATE_CONFIG config payload is untyped dict —              │
  │     │                                                     │ mass-assignment risk                                        │
  └─────┴─────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```
  ---
  Review Agents Used

  kieran-python-reviewer · kieran-typescript-reviewer · security-sentinel · performance-oracle · architecture-strategist ·
  agent-native-reviewer · learnings-researcher

  ---
  Overall Assessment

  The codebase is well-structured and readable — the layered architecture, Service Container pattern, two-phase WebSocket join
  flow, and test infrastructure are all solid. The biggest risks are operational:

  1. P1-001 (event loop blocking) is the most impactful — it degrades every active room when any player submits an answer. Fix
  this first.
  2. P1-004 + P1-005 + P1-006 form a DoS triad — unbounded message size, bypassed rate limits, and no room cap can take down
  the server.
  3. P1-002 (no asyncio lock) is a latent correctness bug that will surface under concurrent load.

  The P1 fixes are all relatively contained — none require architectural overhauls.

  ---
  Want to run browser tests on the affected pages?
  1. Yes — run /game-flow to walk through all game phases
  2. No — skip

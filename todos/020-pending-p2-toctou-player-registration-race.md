---
status: pending
priority: p2
issue_id: "020"
tags: [code-review, backend, concurrency, security]
dependencies: []
---

# TOCTOU Race on Player Registration in Threaded HTTP Handlers

## Problem Statement

FastAPI runs `def` (non-async) route handlers in a thread pool executor. Two concurrent HTTP requests for the same player name in the same room can both pass the `player_id in room.players` check before either write completes, since the check and write are not atomic. The first write succeeds; the second also sees the player present and returns False — but the first request already returned a session token.

## Findings

- File: `backend/src/app/api/routes.py` lines 164–232
- File: `backend/src/app/services/core/room_repository.py` lines 71–98
- `join_room` route is a sync `def` — runs in threadpool, not on event loop
- Check-then-act pattern not atomic under concurrent thread execution

## Proposed Solutions

### Option A: Convert join_room to async def (Recommended)
- Make `join_room` an `async def` — FastAPI runs it directly on the event loop, eliminating thread race
- `register_player` is already synchronous; no blocking I/O inside, so this is safe
- **Pros:** Clean, simple, no lock needed (single-threaded asyncio).
- **Effort:** Small | **Risk:** Low

### Option B: Add threading.Lock in RoomRepository
- Wrap `register_player` with a per-room `threading.Lock`
- **Pros:** Fixes the race without changing async behavior.
- **Cons:** Adds complexity; lock must be acquired cross-thread.
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria
- [ ] Concurrent identical join requests cannot both succeed with the same player name
- [ ] `join_room` endpoint is either `async def` or protected by a lock

## Work Log
- 2026-03-22: Identified by `kieran-python-reviewer` review agent

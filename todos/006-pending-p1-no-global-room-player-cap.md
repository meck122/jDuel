---
status: pending
priority: p1
issue_id: "006"
tags: [code-review, security, backend, dos]
dependencies: ["005"]
---

# No Global Room or Player Count Cap — Memory Exhaustion DoS

## Problem Statement

There is no global limit on active rooms and no per-room player cap enforced server-side. The per-IP rate limiter (5 rooms/min) can be bypassed via IP spoofing (see todo #005). An attacker rotating IPs or operating from many IPs can create thousands of rooms, exhausting the 2.8 GB of available RAM on the 4 GB VPS that also hosts 850 MB+ of NLP models.

## Findings

- File: `backend/src/app/services/core/room_repository.py`
- File: `backend/src/app/api/routes.py`
- No `MAX_ROOMS` constant or check in `RoomRepository.create()`
- `Room` holds question lists, score maps, session tokens, and WebSocket objects — ~50–100 KB per room
- A few hundred bloated rooms exhaust available memory

## Proposed Solutions

### Option A: Add MAX_ROOMS and MAX_PLAYERS_PER_ROOM constants (Recommended)
```python
MAX_ACTIVE_ROOMS = 100
MAX_PLAYERS_PER_ROOM = 8  # matches UI label "2-8 players"

# In RoomRepository.create():
if len(self._rooms) >= MAX_ACTIVE_ROOMS:
    raise RoomLimitError("Server at capacity")

# In register_player():
if len(room.players) >= MAX_PLAYERS_PER_ROOM:
    raise PlayerLimitError("Room is full")
```
- HTTP routes return 503 (server full) or 409 with `ROOM_FULL` detail
- **Pros:** Simple, correct, adds meaningful protection.
- **Effort:** Small | **Risk:** Low

### Option B: Configurable via environment variable
- Read `MAX_ROOMS` from env at startup (default 100)
- **Pros:** Operator can tune without code change.
- **Effort:** Small | **Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details
- Affected files: `room_repository.py`, `routes.py`, `config/game.py` (add constants there)
- Frontend should handle 503 gracefully (show "Server at capacity" message)

## Acceptance Criteria
- [ ] Global room count capped (suggested: 100)
- [ ] Per-room player count capped (suggested: 8, matching UI)
- [ ] HTTP 503 returned when at capacity; 409 when room is full
- [ ] Frontend displays appropriate user-facing error for both cases

## Work Log
- 2026-03-22: Identified by `security-sentinel` review agent

## Resources
- `backend/src/app/services/core/room_repository.py`
- `backend/src/app/api/routes.py`
- `backend/src/app/config/game.py`

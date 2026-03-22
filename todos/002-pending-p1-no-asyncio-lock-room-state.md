---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, architecture, backend, concurrency]
dependencies: []
---

# No asyncio Lock Protecting Concurrent Room State Mutations

## Problem Statement

Every coroutine that touches a `Room` instance operates directly on shared mutable Python dicts/sets with no `asyncio.Lock`. Because asyncio is cooperative, any `await` checkpoint (e.g., `await ws.send_json(...)` inside `broadcast`) yields the event loop, allowing a racing coroutine to enter and mutate the same room state mid-operation.

**Why it matters:** Double state transitions are possible. If `handle_answer` calls `all_players_answered` → True and is about to call `_transition_to_results`, the timer callback `_on_question_timeout` can simultaneously evaluate `room.status == "playing"` → True and also call `_transition_to_results`. Both branches proceed, `start_results_timer` fires twice, and the second timer fires against an already-transitioned room.

## Findings

- File: `backend/src/app/services/orchestration/orchestrator.py`
- File: `backend/src/app/services/core/room_repository.py`
- File: `backend/src/app/services/core/connection_manager.py`
- The rate limiter uses `threading.Lock` (correct), but the game-state layer has no equivalent.
- Timer callbacks (`_on_question_timeout`, `_on_results_timeout`) and WebSocket message handlers (`handle_answer`, `handle_disconnect`) can race at any `await` boundary.

## Proposed Solutions

### Option A: Per-room asyncio.Lock in RoomRepository (Recommended)
- Add `_room_locks: dict[str, asyncio.Lock]` to `RoomRepository`.
- Expose `get_lock(room_id) -> asyncio.Lock`.
- Acquire at the top of every `handle_*` orchestrator method and every timer callback before any read-modify-write sequence.
- **Pros:** Standard asyncio pattern; fits cleanly in existing architecture; minimal structural change.
- **Cons:** Lock contention during broadcast (broadcast holds lock while awaiting sends).
- **Effort:** Medium | **Risk:** Low

### Option B: Optimistic versioning on Room
- Add a `version: int` counter to Room; increment on every state change. Operations that expect a specific version fail if it has changed.
- **Pros:** No lock contention; allows concurrent reads.
- **Cons:** Requires retries on conflict; significantly more complex.
- **Effort:** Large | **Risk:** High

### Option C: Reduce to single-entry async coroutines per room
- Funnel all room mutations through a single `asyncio.Queue` per room with one consumer coroutine.
- **Pros:** Serializes all operations naturally.
- **Cons:** Major architectural refactor; queuing adds latency.
- **Effort:** Large | **Risk:** High

## Recommended Action
<!-- To be filled during triage -->

## Technical Details
- Affected files: `room_repository.py`, `orchestrator.py`, timer callbacks in `timer_service.py`
- The lock must be `asyncio.Lock` (not `threading.Lock`) — the code runs single-threaded asyncio
- Broadcast should either release lock before sending or use a snapshot of state to avoid holding lock during I/O

## Acceptance Criteria
- [ ] Each `handle_answer`, `handle_disconnect`, `handle_start_game`, `_on_question_timeout`, `_on_results_timeout` acquires a per-room lock before mutating room state
- [ ] No double transition to results or game-over possible under concurrent load
- [ ] Lock is cleaned up when room is deleted

## Work Log
- 2026-03-22: Identified by `architecture-strategist` review agent

## Resources
- `backend/src/app/services/orchestration/orchestrator.py`
- `backend/src/app/services/core/room_repository.py`

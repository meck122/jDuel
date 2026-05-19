---
title: "fix: Mobile lobby grace period + visibility-based reconnect"
type: fix
status: active
date: 2026-05-18
origin: docs/brainstorms/2026-05-18-mobile-lobby-grace-reconnect-requirements.md
---

# fix: Mobile lobby grace period + visibility-based reconnect

## Summary

Add a 60s grace window before deleting an empty room in lobby/finished phases, and have the frontend silently reconnect when the tab returns to foreground. Mid-game empty-disconnect behavior is unchanged. Two small surface areas, one backend unit and one frontend unit.

## Problem Frame

On iOS Safari, a host who creates a lobby and switches to Messages to share the link loses the room within seconds — the backend deletes the room the instant the last WebSocket closes, and the frontend has no reconnect on resume. Same shape on desktop solo-host refresh. See origin for full root cause trace.

## Requirements

- R1. Empty room with no active connections survives for 60s before deletion (lobby and finished phases only).
- R2. Reconnect within the grace window cancels the pending deletion and the room continues normally.
- R3. Mid-game empty-disconnect (`PLAYING`, `RESULTS`) continues to hard-close as today.
- R4. iOS Safari: backgrounding the tab and returning within 60s reconnects silently without user action.
- R5. Desktop solo host can refresh the lobby and remain in the same room.

## Scope Boundaries

- No service workers, web push, or background-keepalive mechanisms.
- No cross-device or cross-browser session migration.
- No pause-resume of in-progress games when all players disconnect.
- No user-visible "reconnecting…" indicator or new UI states.
- No retry-on-any-close fallback for transient network failures.

## Context & Research

### Relevant Code and Patterns

- `backend/src/app/services/orchestration/orchestrator.py:469` — `handle_disconnect`, the deletion point to gate.
- `backend/src/app/services/orchestration/orchestrator.py:76` — `handle_connect`, where pending deletions must be cancelled.
- `backend/src/app/services/core/room_manager.py:128` — `delete_room`, called from the grace task on expiry.
- `backend/src/app/services/core/timer_service.py` — pattern for `asyncio.Task`-based cancellable per-room timers. Plan does **not** add the grace task here (TimerService is scoped to game-flow timers); the grace task lives on the orchestrator alongside `_timer_service` and `_speed_battle_handler`.
- `backend/src/app/models/game.py:15-21` — `GameStatus` enum: `WAITING`, `PLAYING`, `RESULTS`, `FINISHED`. Grace applies only to `WAITING` and `FINISHED`.
- `backend/src/app/config/game.py` — home for `EMPTY_ROOM_GRACE_MS`. `GAME_OVER_TIME_MS = 60000` already lives here as a sibling constant.
- `frontend/src/contexts/GameContext.tsx:90-175` — connect/onclose lifecycle; visibility listener attaches here.
- `frontend/src/services/api.ts:115-153` — existing session-token persistence used for reconnection.
- `backend/tests/unit/test_orchestrator.py:214` — existing test `test_handle_disconnect_last_player_deletes_room` whose expectation changes for lobby phase.

### Institutional Learnings

- None directly applicable in `docs/solutions/`. The `room-lifecycle` and `websocket-protocol` skills already describe the two-phase HTTP/WS connection and existing reconnection design — this plan extends that model with a grace window, not a new pattern.

### External References

- Not needed. Local patterns are sufficient (cancellable `asyncio.Task` already used in `TimerService`; session-token reconnection path already exists).

## Key Technical Decisions

- **Grace task lives on the orchestrator, not `TimerService`.** `TimerService` is scoped to game-flow timers (question, results, game-over, speed-battle match, player cooldown). Adding `pending_deletions: dict[str, asyncio.Task]` to `GameOrchestrator` keeps lifecycle concerns separate and avoids reshaping the existing service.
- **Phase check uses `room.status`.** `WAITING` and `FINISHED` get the grace; `PLAYING` and `RESULTS` keep today's immediate delete. Mid-game empty rooms have running timers that would race a grace window — out of scope per origin.
- **Cancel pending deletion at `handle_connect`, not at `attach_connection`.** `handle_connect` already takes the room lock and is the single entry point for WS attach. Cancelling there keeps the cancellation co-located with the connect lifecycle and avoids reaching into `RoomManager`.
- **Frontend visibility listener in `GameContext` directly.** A dedicated `useReconnectOnVisible` hook adds a file for a ~10-line effect that already has all the state it needs in `GameContext`. Inline is the smaller change.
- **Reconnect trigger is `visibilitychange` → visible.** Not `focus`, not `pageshow`, not a `ws.onclose` retry loop. `visibilitychange` is the iOS Safari signal that the tab has come back to foreground; that's the trigger that matches the reported bug. Other triggers expand scope.

## Open Questions

### Resolved During Planning

- **Where does pending-deletion state live?** On `GameOrchestrator` as `_pending_deletions: dict[str, asyncio.Task]`. See Key Technical Decisions.
- **Where does the visibility listener live?** Inline in `GameContext.tsx`. See Key Technical Decisions.

### Deferred to Implementation

- **Exact field/method names** on the orchestrator (`_pending_deletions`, `_schedule_room_deletion`, `_cancel_pending_deletion`, etc.) — settle when writing.
- **Whether the grace task should re-acquire the room lock before deleting.** Probably yes (defense against a join landing between scheduling and firing). Confirm by inspecting the race window when implementing.

---

## Implementation Units

- U1. **Backend: empty-room grace window and reconnect cancellation**

**Goal:** Replace immediate room deletion on last disconnect with a 60s pending deletion that is cancelled if anyone reconnects, gated to lobby/finished phases.

**Requirements:** R1, R2, R3, R5

**Dependencies:** None

**Files:**
- Modify: `backend/src/app/config/game.py`
- Modify: `backend/src/app/services/orchestration/orchestrator.py`
- Modify: `backend/tests/unit/test_orchestrator.py`

**Approach:**
- Add `EMPTY_ROOM_GRACE_MS = 60_000` to `backend/src/app/config/game.py` next to `GAME_OVER_TIME_MS`.
- Add `self._pending_deletions: dict[str, asyncio.Task] = {}` to `GameOrchestrator.__init__`.
- In `handle_disconnect`, when `not room.connections`:
  - If `room.status` is `WAITING` or `FINISHED`: cancel any existing pending deletion for the room (defensive), then call `asyncio.create_task(...)` to schedule the grace task. `create_task` does not block, so the scheduling itself happens cleanly while `handle_disconnect` still holds `room.lock`. The task body runs in its own coroutine and acquires `room.lock` independently *after* the sleep — it must NOT inherit the disconnect's lock. The body sleeps `EMPTY_ROOM_GRACE_MS / 1000`, then under a fresh `room.lock` re-checks `not room.connections` and that the room still exists, and if both hold calls the existing cleanup path (`_timer_service.cancel_all_timers_for_room`, `speed_battle_handler.cleanup_room`, `room_manager.delete_room`). Store the task in `_pending_deletions[room_id]`. `handle_disconnect` returns without calling `delete_room` synchronously.
  - If `room.status` is `PLAYING` or `RESULTS`: preserve current behavior — cancel timers and delete immediately.
- In `handle_connect`, cancel the pending deletion **after `attach_connection` succeeds**, inside the same `room.lock`-guarded block where the connection is attached. Doing it before validation would let a spurious or invalid reconnect attempt (wrong session token, unregistered player) cancel a still-needed grace task; doing it outside the lock would race the task's own re-check. Pop the task from `_pending_deletions[room_id]` and call `.cancel()` on it.
- On the grace task itself: handle the race where the room was already deleted (e.g., concurrent explicit close) — re-check `room_manager.get_room(room_id)` is not None before doing cleanup, and pop self from `_pending_deletions` on exit (both fire and cancel paths).

**Patterns to follow:**
- `backend/src/app/services/core/timer_service.py` — how cancellable `asyncio.Task` timers are stored, cancelled, and re-checked under lock.
- Existing cleanup block at `orchestrator.py:496-499` (cancel timers → speed-battle cleanup → delete room) is the exact sequence to reuse inside the grace task.

**Test scenarios:**
- Happy path: WAITING room, sole player disconnects → room exists immediately after `handle_disconnect` returns → `_pending_deletions` contains a task for that `room_id`.
- Happy path: WAITING room, sole player disconnects, then reconnects via `handle_connect` before grace expires → pending deletion is cancelled, room exists, `_pending_deletions` no longer contains the task.
- Happy path: WAITING room, sole player disconnects, no reconnect, grace expires → room is deleted, timers cancelled, speed-battle state cleaned up. *(Use a small monkey-patched `EMPTY_ROOM_GRACE_MS` or await the task directly rather than sleeping 60s in test.)*
- Edge case: FINISHED room behaves the same as WAITING (grace applies).
- Edge case: PLAYING room, sole player disconnects → room is deleted immediately, no entry in `_pending_deletions`. *(Update the existing `test_handle_disconnect_last_player_deletes_room` to drive the room into PLAYING first, or rename and split into two tests.)*
- Edge case: two players in WAITING, one disconnects → no grace task scheduled (room still has connections).
- Integration: grace task scheduled, then another player joins the room (not the original) → pending deletion is cancelled at their `handle_connect`.

**Verification:**
- `uv run pytest ../tests/unit/test_orchestrator.py` passes including the new scenarios.
- `uv run ruff check . && uv run ruff format .` clean.

---

- U2. **Frontend: reconnect WebSocket on tab visibility**

**Goal:** When the page becomes visible again and the WebSocket is closed but we have a session token for the current room, silently reopen the WebSocket.

**Requirements:** R4, R5

**Dependencies:** None (functionally complete only when U1 is shipped, but the code change is independent and safe to land in either order).

**Files:**
- Modify: `frontend/src/contexts/GameContext.tsx`

**Approach:**
- Add a `useEffect` in `GameProvider` that attaches a `document.addEventListener('visibilitychange', handler)` and removes it on cleanup.
- Handler logic: when `document.visibilityState === 'visible'`, reconnect **only if all of the following hold**:
  - `roomState !== null` — confirms we are in an active session whose `roomId`/`playerId` are already known to the provider. This is the canonical gate; it intentionally excludes initial mount, deep-link cold-start, and full page refresh (those paths are owned by `GamePage`'s existing `registerAndConnect` effect).
  - `wsRef.current` is null OR `wsRef.current.readyState === WebSocket.CLOSED` — the socket actually needs reopening.
  - `isConnecting === false` — no concurrent connection attempt already in flight.
  - `getToken(roomId, playerId)` returns a non-null token.
- When all guards pass, call the existing `connect(roomId, playerId)` path directly. **Do NOT call `joinRoom`** — the backend already keeps the player registered across disconnect (`room.players`) and validates the session token directly on WebSocket attach (`session_tokens` map persists in the room). Re-calling `joinRoom` would unnecessarily hit the HTTP rate limiter and the NAME_TAKEN retry logic.
- Do not surface a "reconnecting…" UI. On success, the next `ROOM_STATE` will repaint the lobby; on failure (room gone past grace), existing code closes with 4004 → "Room not found" → redirect home is the right behavior.

**Patterns to follow:**
- The existing connect path in `GameContext.tsx:90-175` — call it as-is, do not duplicate WS-creation logic.
- `frontend/src/services/api.ts:115-153` for how the session token is read.

**Test scenarios:**
- Test expectation: none — small UX hook with no library-test pattern in this repo, guarded by TypeScript build (`npm run build`). Manual verification on iOS Safari and desktop refresh is the primary signal, per origin's success criteria.

**Verification:**
- `npm run build` succeeds (TypeScript types).
- Manual: iOS Safari — create lobby, switch to Messages for ~30s, return → lobby is intact and connected.
- Manual: iOS Safari — create lobby, switch to Messages for ~90s, return → "Room not found" and redirect home (expected; past grace).
- Manual: Desktop — create lobby alone, refresh → still in same lobby.

---

## System-Wide Impact

- **Interaction graph:** Affects `handle_disconnect` and `handle_connect` in `GameOrchestrator`; the visibility handler in `GameContext` only adds a new path into the existing `connect` call.
- **Error propagation:** Existing 4003 / 4004 close-code handling on the frontend remains the failure surface when the grace window has expired. No new error types.
- **State lifecycle risks:** The race between a grace task firing and a late reconnect is the main concern. Mitigated by re-checking `room.connections` under `room.lock` inside the task before deleting (Approach in U1). Worst-case false-positive: a reconnect lands just after the deletion completes — user sees "Room not found", same as today's behavior past the grace window.
- **API surface parity:** No WebSocket protocol changes. Same close codes, same `ROOM_STATE` shape, same `ROOM_CLOSED` message.
- **Integration coverage:** U1 test scenarios cover the grace × phase × reconnect matrix; U2 relies on manual verification per the Test scenarios note above.
- **Unchanged invariants:** `MAX_ROOMS = 100` and per-IP rate limits are unaffected. Session token TTL is unchanged. Mid-game disconnect semantics are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Grace task fires concurrently with a late reconnect, deleting the room out from under the new connection | Grace task re-checks `room.connections` under `room.lock` before deleting; cancel-on-connect in `handle_connect` removes the task before it can fire on the common path. |
| `_pending_deletions` leaks tasks across server lifetime | Tasks self-remove from the dict on both fire and cancel paths; size is bounded by `MAX_ROOMS = 100` even in the pathological case. |
| iOS Safari throttles or skips the `visibilitychange` event on slow returns | Falls through to existing close-code handling — same UX as today past the grace window. Not a regression. |
| Existing `test_handle_disconnect_last_player_deletes_room` semantics change | Plan calls out the test update explicitly in U1 file list; reviewer should expect the diff. |

## Documentation / Operational Notes

- Consider a one-line note in `docs/EventProtocol.md` near the close-code list mentioning that empty rooms in lobby/finished have a 60s grace window before cleanup. Not strictly required — the protocol surface is unchanged — but it documents observable timing for any external integrator.
- No metrics or rollout changes. The change is observable through the existing room-count metric (`metrics-overview.md`); brief uptick in steady-state room count is expected and bounded by the grace window.

## Sources & References

- Origin document: [docs/brainstorms/2026-05-18-mobile-lobby-grace-reconnect-requirements.md](../brainstorms/2026-05-18-mobile-lobby-grace-reconnect-requirements.md)
- Related code: `backend/src/app/services/orchestration/orchestrator.py`, `frontend/src/contexts/GameContext.tsx`
- Related skills: `room-lifecycle`, `websocket-protocol`

# Mobile Lobby Grace Period + Visibility Reconnect

**Date:** 2026-05-18
**Status:** Requirements (ready for planning)
**Scope:** Standard (lightweight fix with one product decision)

## Problem

A solo host who creates a lobby on mobile, then leaves Safari to text the room link to a friend, loses the room before they return. Returning to Safari shows "Room not found" and redirects home.

The same shape of bug exists on desktop: a solo host alone in a lobby who refreshes the page kills the room, because the WebSocket closes faster than the new page can rejoin.

### Root cause (verified in the codebase)

Three things compound:

1. **Backend deletes the room the moment the last WS disconnects.** In `backend/src/app/services/orchestration/orchestrator.py:469-499`, `handle_disconnect` calls `delete_room` immediately when `room.connections` is empty. The comment says players stay registered "to allow reconnection," but that only matters when *other* players are still connected. A solo host has no buffer.
2. **iOS Safari closes background WebSockets quickly.** Switching to another app suspends the tab; the socket closes within seconds.
3. **No frontend reconnect.** `frontend/src/contexts/GameContext.tsx:159-172`'s `ws.onclose` only flips state — it never retries, even when the page is brought back to the foreground.

## Goal

Make "create lobby → switch apps to share the link → return" work on mobile without losing the room, with a fix small enough to ship in one PR. Also fixes solo-host refresh on desktop as a side effect.

## Stated requirements

### Backend
- Add a configurable empty-room grace window (default 60s) before deleting a room with no active WebSocket connections.
- Grace **only applies in lobby and finished phases.** If everyone disconnects mid-game, hard-close the room as today.
- If any player reconnects within the grace window, cancel the pending deletion and the room continues normally.
- Cancel any room-level timers when the grace begins; restart them only if the room is meant to be live after the reconnect (lobby has no active timers, so this is mostly a no-op for the in-scope phases).

### Frontend
- On `document.visibilitychange` → visible, if a session token exists for the current room and the WebSocket is not open, transparently reconnect using the existing session-token path in `frontend/src/services/api.ts`.
- No new UI affordance ("reconnecting…" indicator, banner, etc.) — silent on success, the existing "Room not found" / `ROOM_CLOSED` handling stays as the failure path.
- Do **not** add a retry loop on every unexpected close. Reconnect is gated on `visibilitychange`, which is the trigger that actually matches the reported bug.

## Inferred decisions (open for correction in planning)

- New config constant `EMPTY_ROOM_GRACE_MS = 60_000` in `backend/src/app/config/game.py`.
- Implementation reuses `TimerService` for the cancellable cleanup task, matching the existing pattern for per-room timers.
- Test coverage: one unit test for "last disconnect in lobby → reconnect within grace → room survives," one for "last disconnect in lobby → wait past grace → room is gone," and one for "last disconnect mid-game → room hard-closes immediately." No frontend test changes assumed beyond what TypeScript build catches.

## Non-goals

- Service workers, web push, or any mechanism intended to keep the WebSocket alive while the tab is suspended.
- Cross-device or cross-browser session migration.
- Pause/resume of an in-progress game when all players disconnect.
- A user-visible "reconnecting…" indicator or any new UI states.
- Broader retry-on-any-close logic for transient network failures.

## Success criteria

- On iOS Safari: create a lobby, switch to Messages for up to 60s, return — the lobby is still there and the host is connected again without any user action beyond returning to the tab.
- On desktop: solo host alone in a lobby can refresh and remain in the same room.
- After 60s away, the room is cleaned up as before.
- Mid-game everyone-disconnect behavior is unchanged.

## Dependencies / assumptions

- Session tokens already persist across reload and reconnection (`frontend/src/services/api.ts:115-153`). Verified.
- `MAX_ROOMS = 100` (`backend/src/app/config/game.py`) is unaffected — the grace window is short and applies to rooms already empty, so worst-case carrying cost is bounded by the existing rate limits.
- iOS Safari's WebSocket-on-background behavior is the assumed cause; if there's a separate failure (e.g., session token expiry) we should surface it during implementation.

## Open questions for planning

- Exactly how to cancel the pending deletion on reconnect — likely a `pending_deletions: dict[str, Task]` on `RoomManager` or `Orchestrator`, but the right home depends on `TimerService` semantics.
- Whether the visibility handler belongs in `GameContext` directly or in a small hook (`useReconnectOnVisible`) — taste call for the implementer.

## Related docs

- `docs/EventProtocol.md` — WebSocket lifecycle and close codes (4003, 4004 already handled in `GameContext`).
- `room-lifecycle` skill — broader room creation → cleanup flow.
- `websocket-protocol` skill — connection lifecycle and reconnection semantics.

---
status: pending
priority: p2
issue_id: "021"
tags: [code-review, frontend, react, routing]
dependencies: ["015"]
---

# GameProvider Above Router Allows Stale roomState to Leak Across Sessions

## Problem Statement

`GameProvider` wraps `<Router>` in `App.tsx`, meaning WebSocket state (roomId, playerId, roomState) survives navigation between pages. A user who navigates to `/` via the browser back button while `GameProvider` still holds a live connection and room state will see stale data. There is no `reset` primitive to clear state without disconnecting.

## Findings

- File: `frontend/src/App.tsx` lines 22–37
- `GameProvider` at app level means state persists across all route changes
- `connect()` calls `disconnect()` first — handles reconnect path
- No path handles "user goes home without triggering connect" — state not cleared

## Proposed Solution

Add a `reset()` action to `GameContextValue` that clears `roomId`, `playerId`, `roomState`, and `connectionError` without touching the WebSocket connection. `HomePage` calls `reset()` on mount:
```ts
useEffect(() => {
  reset();
}, []);
```

Alternatively, resolve via the fix in #015 — if `GameProvider` is moved inside `<Router>`, it can be scoped to `GamePage` only and unmounts with the game route.

## Acceptance Criteria
- [ ] `HomePage` always renders with clean game state (no stale `roomState`)
- [ ] Either a `reset()` action exists and is called on home mount, or `GameProvider` is scoped to game routes

## Work Log
- 2026-03-22: Identified by `architecture-strategist` review agent

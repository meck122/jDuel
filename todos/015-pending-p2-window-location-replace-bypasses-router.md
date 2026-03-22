---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, frontend, websocket, routing]
dependencies: []
---

# window.location.replace Bypasses React Router on ROOM_CLOSED

## Problem Statement

When the server sends `ROOM_CLOSED`, `GameContext` calls `window.location.replace("/")` which causes a full page reload. This bypasses React Router 7's history stack, discards all React state, and in SPA mode causes an unnecessary network request. The `onRoomClosedRef.current?.()` callback exists for exactly this purpose but is never wired up (the prop is never passed to `GameProvider`).

## Findings

- File: `frontend/src/contexts/GameContext.tsx` line 129
```ts
case "ROOM_CLOSED":
  clearToken(newRoomId, newPlayerId);
  onRoomClosedRef.current?.();
  window.location.replace("/");  // always fires, full page reload
  break;
```
- File: `frontend/src/App.tsx` line 22 — `<GameProvider>` has no `onRoomClosed` prop
- The callback exists but is dead code; `window.location.replace` always wins

## Proposed Solution

1. Remove `window.location.replace("/")` from `GameContext`
2. Wire `onRoomClosed` in `App.tsx` to navigate via React Router:
```tsx
// App.tsx
function AppContent() {
  const navigate = useNavigate();
  return (
    <GameProvider onRoomClosed={() => navigate("/")}>
      <Routes>...</Routes>
    </GameProvider>
  );
}
```
3. `GameProvider` must be inside `<Router>` for `useNavigate` to work — move it down:
```tsx
// App.tsx
<Router>
  <AppContent />
</Router>
```

## Acceptance Criteria
- [ ] `ROOM_CLOSED` triggers React Router navigation, not `window.location.replace`
- [ ] No full page reload on room closure
- [ ] `onRoomClosed` callback is wired in `App.tsx`
- [ ] `GameProvider` is inside `<Router>` (or `AppContent` pattern used)

## Work Log
- 2026-03-22: Identified by `kieran-typescript-reviewer` review agent

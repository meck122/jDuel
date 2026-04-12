---
title: "fix: Redirect player to home page on ROOM_CLOSED"
type: fix
date: 2026-02-11
---

# fix: Redirect player to home page on ROOM_CLOSED

When the 60-second game-over timer expires, the backend sends `ROOM_CLOSED` to all connected players and deletes the room. The frontend already handles this message in `GameContext.tsx:126-128` — it clears the session token and calls `onRoomClosedRef.current?.()`. However, no `onRoomClosed` callback is ever provided, so the player stays stranded on the GameOver screen with a dead WebSocket.

## Proposed Fix

Add `window.location.replace("/")` as a fallback in the `ROOM_CLOSED` handler. A full page reload is appropriate here because:

1. The room no longer exists — all game state should be fully cleared
2. `GameProvider` sits above `Router` in `App.tsx:22-36`, so `useNavigate()` isn't available
3. A full reload ensures no stale WebSocket refs, room state, or context values persist

**File:** `frontend/src/contexts/GameContext.tsx` (~line 126-128)

```typescript
case "ROOM_CLOSED":
  clearToken(newRoomId, newPlayerId);
  onRoomClosedRef.current?.();
  // Redirect to home — full reload clears all game state
  window.location.replace("/");
  break;
```

The `onRoomClosedRef` callback still fires first (if provided), preserving the existing API. The `window.location.replace("/")` fires unconditionally after — `replace` prevents back-button returning to a dead game page.

## Acceptance Criteria

- [x] Player is redirected to home page when room closes after 60-second timer
- [x] Session token is cleared before redirect
- [x] Back button does not return to the dead game page (`replace` used)
- [x] No console errors during redirect (build passes clean)

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/contexts/GameContext.tsx` | Add `window.location.replace("/")` in ROOM_CLOSED case |

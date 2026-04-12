# TODO-015 [P2] ROOM_CLOSED Causes Full Page Reload

## Status: Pending

## Problem

When the server sends a `ROOM_CLOSED` message, the frontend uses `window.location.replace("/")` instead of React Router navigation. This causes a full page reload, losing all React state and creating a jarring UX.

## Affected Files

- `frontend/src/contexts/GameContext.tsx:126-130` — `ROOM_CLOSED` case calls `window.location.replace("/")`

## Fix

Use React Router's `useNavigate()`:

```typescript
// Before
window.location.replace("/");

// After
navigate("/", { replace: true });
```

Note: There's already an existing plan at `docs/plans/2026-02-11-fix-room-closed-redirect-home-plan.md` — check if it was partially implemented.

## Impact

- **Severity:** Poor UX, state loss
- **Fix complexity:** Low — single line change (if navigate is accessible in context)

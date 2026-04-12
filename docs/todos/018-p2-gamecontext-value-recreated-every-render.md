# TODO-018 [P2] GameContext Value Recreated Every Render

## Status: Pending

## Problem

The `GameContext.Provider` value object is recreated on every render, causing all consuming components to re-render on every state update — even if the specific values they use haven't changed. With frequent WebSocket broadcasts, this creates unnecessary rendering overhead.

## Affected Files

- `frontend/src/contexts/GameContext.tsx:207-223` — `value` object literal recreated every render as `GameContextValue`

## Fix

Memoize the context value:

```typescript
const contextValue = useMemo(() => ({
  roomState,
  sendMessage,
  // ... other values
}), [roomState, sendMessage, /* stable deps */]);

return (
  <GameContext.Provider value={contextValue}>
    {children}
  </GameContext.Provider>
);
```

Ensure `sendMessage` and other callbacks are wrapped in `useCallback`.

## Impact

- **Severity:** Performance — all game components re-render per broadcast
- **Fix complexity:** Low — add useMemo/useCallback

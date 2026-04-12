# TODO-003 [P1] Unguarded JSON.parse in WebSocket onmessage

## Status: Pending

## Problem

In `frontend/src/contexts/GameContext.tsx`, the `ws.onmessage` handler calls `JSON.parse(event.data)` without a try/catch. If the server sends malformed data (network corruption, partial frame), this throws an unhandled exception that silently breaks the WebSocket handler — the UI freezes with no error feedback.

## Affected Files

- `frontend/src/contexts/GameContext.tsx:108` — `JSON.parse(event.data)` in `ws.onmessage` with no try/catch

## Fix

Wrap in try/catch:

```typescript
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    // ... handle message
  } catch (e) {
    console.error("Failed to parse WebSocket message:", e);
    return;
  }
};
```

## Impact

- **Severity:** Silent UI freeze on any malformed message
- **Fix complexity:** Low — single try/catch addition
- **Risk:** None

## Testing

- `npm run build` (type-checks)
- Manual test with network throttling

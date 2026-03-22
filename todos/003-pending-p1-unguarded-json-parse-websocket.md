---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, frontend, websocket, error-handling]
dependencies: []
---

# Unguarded JSON.parse in WebSocket onmessage Can Freeze UI

## Problem Statement

`JSON.parse` on WebSocket messages has no error boundary. If the server sends malformed JSON (network corruption, partial frame, or a backend bug), `JSON.parse` throws synchronously inside `ws.onmessage`. This throw is uncaught — it bypasses React error boundaries, bypasses `ws.onerror`, and leaves `isConnecting` stuck at its current value. The user sees a frozen UI with no error message.

## Findings

- File: `frontend/src/contexts/GameContext.tsx` line 108
```ts
const data: WebSocketMessage = JSON.parse(event.data);
```
- Synchronous throw inside a native WebSocket event handler is not caught by React error boundaries
- `ws.onerror` does NOT receive thrown JS exceptions — only network-level WebSocket errors
- Result: frozen UI, no user feedback, connection state stuck

## Proposed Solutions

### Option A: try/catch → setConnectionError (Recommended)
```ts
ws.onmessage = (event) => {
  let data: WebSocketMessage;
  try {
    data = JSON.parse(event.data);
  } catch (e) {
    setConnectionError("Received invalid message from server");
    return;
  }
  // ... existing handler
};
```
- **Pros:** Simple, correct, surfaces error to user.
- **Cons:** None significant.
- **Effort:** Small | **Risk:** Low

### Option B: Validate message shape after parse
- Wrap both `JSON.parse` and the message type switch in try/catch.
- **Pros:** Also catches bad message shapes, not just parse failures.
- **Effort:** Small | **Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details
- Affected file: `frontend/src/contexts/GameContext.tsx` line 108

## Acceptance Criteria
- [ ] `JSON.parse` failure in `ws.onmessage` is caught and results in `setConnectionError` call
- [ ] User sees an error message rather than frozen UI
- [ ] No unhandled throw propagates from the WebSocket message handler

## Work Log
- 2026-03-22: Identified by `kieran-typescript-reviewer` review agent

## Resources
- `frontend/src/contexts/GameContext.tsx`

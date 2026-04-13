---
date: 2026-04-12
topic: ws-session-token-validation
---

# WebSocket Session Token Validation

## Problem Frame

The HTTP join endpoint (`POST /api/rooms/{roomId}/join`) generates a `session_token` and stores it
in `room.session_tokens[playerId]`. The token is returned to the client and stored in localStorage.
It is already validated on HTTP reconnection requests.

However, the WebSocket handler (`websocket_handler.py`) never checks this token. Any caller who
knows a valid `(roomId, playerId)` pair — both of which are short, user-visible strings — can
connect to that player's WebSocket slot without the token. This enables player impersonation: an
attacker can take over a registered player's game slot before or after the legitimate player
connects.

## Requirements

- R1. The `/ws` endpoint must accept a `sessionToken` query parameter (required, non-empty, max 64 chars).
- R2. Before accepting the WebSocket connection, the handler must verify that the provided token
  matches the value stored in `room.session_tokens[playerId]`. If the token is missing from the
  server, or does not match, the connection must be rejected (close code 4003, reason "Unauthorized")
  without calling `ws.accept()`.
- R3. The frontend must include the `sessionToken` in the WebSocket URL when connecting. The token
  is retrieved from localStorage via the existing `getStoredTokens()` helper in `api.ts`.
- R4. If the frontend has no token in localStorage for the given `(roomId, playerId)`, the
  connection attempt must fail rather than connect without a token. The user must re-join via the
  HTTP endpoint (which re-issues a fresh token) before reconnecting.

## Success Criteria

- A WebSocket connection attempt using a valid `(roomId, playerId)` but an incorrect or missing
  `sessionToken` is rejected before the connection is accepted.
- A legitimate player connecting immediately after HTTP join succeeds without any UX change.
- A player who clears localStorage can recover by re-entering via the join flow, which re-issues a
  token and stores it.

## Scope Boundaries

- Token generation and storage are already handled — no changes to the join endpoint logic.
- This does not change the reconnection flow at the HTTP layer (already validates token there).
- No changes to token lifetime or rotation; tokens persist for the lifetime of the room.
- No changes to any other WebSocket query params or the wire protocol beyond adding `sessionToken`.

## Key Decisions

- **Fail closed on missing token:** If the frontend has no token in localStorage, the WS connection
  is rejected. The user re-joins via HTTP, which re-issues a fresh token. A fallback that accepts
  missing tokens would undo the security fix.
- **Query param transport:** The browser WebSocket API does not support custom headers; a query
  param is the only viable transport mechanism for the initial handshake.
- **Reject before `ws.accept()`:** The token check must happen before `ws.accept()` so the
  connection is cleanly refused at the protocol level (close frame before handshake completes),
  consistent with the existing room and player checks.

## Dependencies / Assumptions

- The frontend always has a valid token in localStorage after a successful HTTP join — this is
  already true since `api.ts` stores the token in the `joinRoom` response handler.
- Single-server deployment means no cross-instance session state issues.

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Technical] Where exactly in `GameContext.tsx` should the token be retrieved —
  inside `connectToRoom` (looks up from localStorage using roomId + playerId) or passed as a
  parameter from the call site? Prefer the approach that minimises changes to the `connectToRoom`
  signature.
- [Affects R1][Technical] Confirm the correct max length for the `sessionToken` query param —
  `secrets.token_urlsafe(32)` produces a 43-character base64url string; 64 chars is a safe upper
  bound.

## Next Steps

→ `/ce:plan` for structured implementation planning

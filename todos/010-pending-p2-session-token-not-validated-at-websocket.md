---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, security, backend, websocket, auth]
dependencies: []
---

# Session Token Not Validated at WebSocket Connection Gate

## Problem Statement

The WebSocket handshake checks only that `playerId` is registered and not currently connected — it does NOT require the session token. An attacker who knows a valid `roomId` and `playerId` (both observable/predictable) can connect to a disconnected player's slot before the legitimate player reconnects, bypassing token validation entirely.

The session token is enforced only at the HTTP phase (`POST /api/rooms/:id/join`), but an attacker can skip HTTP and go directly to the WebSocket endpoint.

## Findings

- File: `backend/src/app/api/websocket_handler.py` lines 40–55
- File: `backend/src/app/main.py` lines 51–66
- The WebSocket endpoint accepts `roomId` and `playerId` query params but no `sessionToken`
- Players can hijack disconnected slots by racing to the WebSocket endpoint directly

## Proposed Solutions

### Option A: Pass sessionToken as WebSocket query param and validate (Recommended)
- Add `token: str = Query(...)` to the WebSocket endpoint
- In `handle_websocket`, validate `token == room.session_tokens.get(player_id)`
- Frontend already has the token from `joinRoom` response; pass it as `?token=...`
- **Pros:** Closes the gap cleanly; token was designed for exactly this.
- **Effort:** Medium | **Risk:** Low

### Option B: Short-lived one-time nonce
- HTTP join issues a 30-second nonce; WS connect must present and consume it
- **Pros:** Token rotation prevents replay attacks.
- **Cons:** More complex; requires nonce storage.
- **Effort:** Large | **Risk:** Medium

## Acceptance Criteria
- [ ] WebSocket connection requires valid session token in query param
- [ ] Connecting without token or with wrong token is rejected (close code 4003)
- [ ] Frontend passes token from `joinRoom` response when opening WebSocket
- [ ] Reconnection flow still works (token persisted in localStorage alongside playerId)

## Work Log
- 2026-03-22: Identified by `security-sentinel` review agent

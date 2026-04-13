---
title: "fix: Validate session token at WebSocket connection"
type: fix
status: active
date: 2026-04-12
origin: docs/brainstorms/2026-04-12-ws-session-token-validation-requirements.md
---

# fix: Validate Session Token at WebSocket Connection

## Overview

The HTTP join endpoint already generates a `session_token` and stores it in
`room.session_tokens[playerId]`. The frontend already stores this token in localStorage. The
WebSocket handshake currently ignores it — anyone who knows a valid `(roomId, playerId)` pair can
claim that player's slot.

This plan closes that gap in four files: backend endpoint declaration, backend handler validation,
a frontend export, and the frontend WS URL builder. All integration tests that open WS connections
also need token threading.

## Problem Statement

`websocket_handler.py` checks that the room exists, the player is registered, and the player is not
already connected — but never validates the session token. Since room codes are short (4 chars) and
player IDs are user-chosen names, both are guessable or observable. An attacker can impersonate any
registered-but-disconnected player without possessing their session token.

See origin doc for full framing:
[docs/brainstorms/2026-04-12-ws-session-token-validation-requirements.md](../brainstorms/2026-04-12-ws-session-token-validation-requirements.md)

## Proposed Solution

Add `sessionToken` as a required query parameter to the `/ws` endpoint. Validate it against
`room.session_tokens[playerId]` before calling `ws.accept()`. The frontend retrieves the token from
localStorage and appends it to the WS URL. The change is fail-closed: if the frontend has no token,
the connection is rejected and the user must re-join via the HTTP endpoint (which re-issues a
fresh token).

## Technical Considerations

- **Token transport**: The browser WebSocket API does not support custom request headers. A query
  parameter is the only viable transport at connection time. The token will appear in nginx access
  logs (the `/ws` path includes query params by default); this is an acceptable tradeoff given the
  threat model.
- **Reject before `ws.accept()`**: The token check must happen before `ws.accept()` so the
  connection is cleanly refused at the protocol level, consistent with the room-not-found and
  player-not-registered checks above it.
- **Close code**: Use `4008` (currently unused). The existing series is `4003` (not registered),
  `4004` (room not found), `4009` (already connected). `4008` fits the client-error range for an
  auth/token failure.
- **Token lookup**: `getToken(roomId, playerId)` already exists in `api.ts:53` but is not exported.
  Adding `export` is the only change needed there.
- **Token format**: `secrets.token_urlsafe(32)` produces a 43-character base64url string. Use
  `max_length=64` as the query param upper bound for a safe margin.
- **Server restart / fresh room**: If the server restarts, `room.session_tokens` is empty (in-memory
  state). A client with a stale localStorage token will fail the check (token not stored server-side)
  and land on re-join — which works correctly.

## System-Wide Impact

- **Existing "already connected" check** (`4009`) remains in place after the token check. It is now
  a second layer rather than the primary defence.
- **HTTP reconnection** in `routes.py` already validates the token — no change needed there.
- **All existing WS integration tests** use `?roomId=X&playerId=Y` URLs without a token. Every test
  that opens a WS connection will need the token threaded through from the join response.
  `_setup_room()` must be updated to capture and return tokens.
- **nginx logs**: `/ws?roomId=AB3D&playerId=Alice&sessionToken=<43chars>` will appear in access
  logs. Tokens are short-lived (room lifetime only) and single-server; log exposure is acceptable.

## Acceptance Criteria

- [ ] R1: `/ws` endpoint declares `sessionToken: str = Query(..., min_length=1, max_length=64)`
- [ ] R2: `websocket_handler.py` rejects connections with close code `4008` when the provided
  token does not match `room.session_tokens.get(player_id)` (including when no token is stored)
- [ ] R3: Frontend WS URL includes `&sessionToken=<token>` retrieved from localStorage
- [ ] R4: If no token is found in localStorage, the WS URL is not constructed and the connection
  attempt fails gracefully (user is directed to re-join)
- [ ] All existing integration tests pass after token threading
- [ ] New integration tests cover: (a) valid token connects, (b) wrong token → 4008,
  (c) missing token (no query param) → 4008 or FastAPI 422

## Implementation Steps

### Step 1 — `backend/src/app/main.py`

Add `sessionToken` as a required `Query` parameter to the `/ws` endpoint function signature.
Pass it down to `handle_websocket`.

```python
# backend/src/app/main.py  (ws_endpoint function)
@_app.websocket("/ws")
async def ws_endpoint(
    websocket: WebSocket,
    roomId: str = Query(..., pattern=ROOM_ID_PATTERN, ...),
    playerId: str = Query(..., min_length=1, max_length=20, ...),
    sessionToken: str = Query(..., min_length=1, max_length=64,
                               description="Session token from HTTP join"),
):
    await handle_websocket(websocket, roomId.upper(), playerId, sessionToken)
```

### Step 2 — `backend/src/app/api/websocket_handler.py`

Update `handle_websocket` signature to accept `session_token: str`. Add the validation check
immediately after the "already connected" check (line 52), before `ws.accept()`.

```python
# backend/src/app/api/websocket_handler.py
async def handle_websocket(ws: WebSocket, room_id: str, player_id: str, session_token: str) -> None:
    ...
    # Existing checks (room exists, player registered, not already connected)
    ...

    # Validate session token
    stored_token = room.session_tokens.get(player_id)
    if not stored_token or session_token != stored_token:
        await ws.close(code=4008, reason="Unauthorized")
        return

    # Accept the WebSocket connection
    await ws.accept()
    ...
```

### Step 3 — `frontend/src/services/api.ts`

Export `getToken` (currently unexported, line 53). Add `export` keyword:

```typescript
// frontend/src/services/api.ts:53
export function getToken(roomId: string, playerId: string): string | undefined {
  const key = `${roomId}:${playerId}`;
  return getStoredTokens()[key];
}
```

### Step 4 — `frontend/src/contexts/GameContext.tsx`

Import `getToken` and use it inside the `connect` callback. If no token is available, do not
attempt the WS connection and surface an error.

```typescript
// frontend/src/contexts/GameContext.tsx
import { clearToken, getToken } from "../services/api";

// Inside connect(newRoomId, newPlayerId):
const token = getToken(newRoomId, newPlayerId);
if (!token) {
  setConnectionError("Session expired. Please re-join the room.");
  setIsConnecting(false);
  return;
}
const wsUrl = `${WS_URL}?roomId=${encodeURIComponent(newRoomId)}&playerId=${encodeURIComponent(newPlayerId)}&sessionToken=${encodeURIComponent(token)}`;
```

The `connect` function signature is **unchanged** (`connect(newRoomId, newPlayerId)`) — callers in
`GamePage.tsx` require no modification.

### Step 5 — `backend/tests/integration/test_websocket.py`

Update `_setup_room` to capture and return tokens so all test WS URLs can include them.

```python
def _setup_room(client: TestClient, players: list[str]) -> tuple[str, dict[str, str]]:
    """Helper: create a room and register all players.
    Returns (roomId, {playerName: sessionToken})."""
    room_id = client.post("/api/rooms").json()["roomId"]
    tokens: dict[str, str] = {}
    for name in players:
        resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": name})
        tokens[name] = resp.json()["sessionToken"]
    return room_id, tokens
```

Update all existing test WS URLs to include `&sessionToken={tokens[name]}`.

Add new test cases:

```python
def test_connect_4008_invalid_token(self, client):
    room_id, tokens = _setup_room(client, ["Alice"])
    _assert_ws_close_code(
        client,
        f"/ws?roomId={room_id}&playerId=Alice&sessionToken=wrongtoken",
        4008,
    )

def test_connect_422_missing_token(self, client):
    """Missing required sessionToken query param → FastAPI 422 (before WS upgrade)."""
    room_id, _ = _setup_room(client, ["Alice"])
    _assert_ws_close_code(client, f"/ws?roomId={room_id}&playerId=Alice", 422)

def test_connect_valid_token_succeeds(self, client):
    room_id, tokens = _setup_room(client, ["Alice"])
    with client.websocket_connect(
        f"/ws?roomId={room_id}&playerId=Alice&sessionToken={tokens['Alice']}"
    ) as ws:
        msg = ws.receive_json()
        assert msg["type"] == "ROOM_STATE"
```

## Dependencies & Risks

- **Single coordinated deploy**: Frontend and backend must be deployed together. If backend is
  deployed first, the old frontend (no token in URL) will be rejected with 4008. On the single
  Oracle VPS this is handled atomically by `deploy.sh`.
- **localStorage cleared between sessions**: Users who clear site data will need to re-join.
  The re-join HTTP flow already handles this (re-issues a fresh token). No UX degradation beyond
  what a cleared localStorage already causes.
- **FastAPI 422 for missing param**: If `sessionToken` is omitted entirely from the query string,
  FastAPI returns a 422 before the WS upgrade. `_assert_ws_close_code` may need a small adjustment
  to handle this (the close code from a 422 may differ from a WS-level close). Verify in tests.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-12-ws-session-token-validation-requirements.md](../brainstorms/2026-04-12-ws-session-token-validation-requirements.md)
  — Key decisions carried forward: fail-closed on missing token, query param transport, reject before `ws.accept()`
- `backend/src/app/api/websocket_handler.py` — handler with existing checks at lines 42–54
- `backend/src/app/api/routes.py` — token generation at lines 237–249, storage at line 249
- `backend/src/app/models/game.py` — `session_tokens: dict[str, str]` at line 62
- `frontend/src/services/api.ts` — `getToken` at line 53, `storeToken` at line 46
- `frontend/src/contexts/GameContext.tsx` — WS URL construction at line 93
- `backend/tests/integration/test_websocket.py` — `_setup_room` at line 8, existing close code tests

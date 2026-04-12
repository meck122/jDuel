# TODO-010 [P2] Session Token Not Validated at WebSocket Gate

## Status: Pending

## Problem

The WebSocket endpoint accepts connections using only the room ID and player ID from the URL path. There's no session token validation — anyone who knows (or guesses) a player ID can hijack their WebSocket slot.

## Affected Files

- `backend/src/app/api/websocket_handler.py:21-67` — `handle_websocket()` checks room/player existence at lines 40-47 but never validates session token
- `backend/src/app/api/routes.py:224-242` — HTTP join generates `session_token = secrets.token_urlsafe(32)` and stores it in `room.session_tokens`

## Fix

1. Return a short-lived session token from `POST /api/rooms/{id}/join`
2. Require it as a query param or first WS message: `/ws/{room_id}/{player_id}?token=abc123`
3. Validate the token before accepting the WebSocket connection

```python
token = websocket.query_params.get("token")
if not room_manager.validate_session(room_id, player_id, token):
    await websocket.close(code=4001, reason="Invalid session")
    return
```

## Impact

- **Severity:** Player slot hijacking possible if player IDs are predictable
- **Fix complexity:** Medium — requires token generation, storage, and validation

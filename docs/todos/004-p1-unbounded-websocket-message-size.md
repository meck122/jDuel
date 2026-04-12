# TODO-004 [P1] Unbounded WebSocket Message Size

## Status: Pending

## Problem

The FastAPI WebSocket endpoint has no `max_size` limit. A single client can send an arbitrarily large payload (e.g., multi-GB answer string), causing the server to allocate unbounded memory — OOM crash.

## Affected Files

- `backend/src/app/api/websocket_handler.py:69` — `await ws.receive_text()` with no size limit
- `backend/src/app/main.py:50-66` — WebSocket endpoint definition, no max_size config

## Fix

Set `max_size` on the WebSocket connection. In Starlette/FastAPI:

```python
# In main.py or websocket route
@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, ...):
    # Starlette supports max_size in websocket.accept()
    # Or configure at the ASGI server level in uvicorn:
    # uvicorn app.main:app --ws-max-size 65536
```

Also add application-level validation:

```python
raw = await websocket.receive_text()
if len(raw) > 4096:  # generous limit for game messages
    await websocket.close(code=1009, reason="Message too large")
    return
```

## Impact

- **Severity:** Single player can OOM the 4GB VPS
- **Fix complexity:** Low — one-line uvicorn config + application check
- **Risk:** None (game messages are tiny)

## Testing

- Test with oversized messages in integration tests
- Verify clean disconnect on oversized payload

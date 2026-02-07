---
name: ws-message-checklist
description: Step-by-step checklist for adding a new WebSocket message type end-to-end (backend → frontend). Use when implementing new player actions or server broadcasts.
---

# WebSocket Message Checklist

Follow this checklist to add a new WebSocket message type that flows correctly through the entire stack.

## Backend Changes

### 1. Define the Message Model ([`backend/src/app/models/websocket_messages.py`](backend/src/app/models/websocket_messages.py))

Add a Pydantic model for the new message:

```python
class YourNewMessage(BaseModel):
    """Description of what this message does."""
    type: Literal["YOUR_MESSAGE_TYPE"]
    someField: str
    anotherField: int
```

### 2. Update the Union Type

Add the new type literal to `WebSocketClientMessage.type`:

```python
type: Literal["START_GAME", "ANSWER", "UPDATE_CONFIG", "REACTION", "YOUR_MESSAGE_TYPE"]
```

### 3. Route in WebSocket Handler (`backend/src/app/api/websocket_handler.py`)

Add a case in the message routing loop:

```python
elif msg_type == "YOUR_MESSAGE_TYPE":
    validated = YourNewMessage.model_validate(message)
    await orchestrator.handle_your_action(
        room_id, player_id, validated.someField, validated.anotherField
    )
```

### 4. Implement Handler in Orchestrator (`backend/src/app/services/orchestration/orchestrator.py`)

Add the handler method:

```python
async def handle_your_action(
    self, room_id: str, player_id: str, some_field: str, another_field: int
) -> None:
    """Handle YOUR_MESSAGE_TYPE action.

    Args:
        room_id: The room ID
        player_id: The player initiating the action
        some_field: Description
        another_field: Description
    """
    room = self._room_manager.get_room(room_id)
    if not room:
        return

    # Validate phase, permissions, etc.
    # Mutate room state
    # Broadcast result
    await self._broadcast_room_state(room_id)
```

**Note:** If you need to broadcast a lightweight message (like `REACTION`), call `room_manager.broadcast_state(room_id, custom_dict)` instead of `_broadcast_room_state`.

## Frontend Changes

### 5. Add TypeScript Type ([`frontend/src/types/index.ts`](frontend/src/types/index.ts))

Add a new variant to the `WebSocketMessage` discriminated union:

```typescript
export type WebSocketMessage =
  | { type: "ROOM_STATE"; roomState: RoomState }
  | { type: "REACTION"; playerId: string; reactionId: number }
  | { type: "YOUR_MESSAGE_TYPE"; someField: string; anotherField: number }
  | { type: "ROOM_CLOSED" }
  | { type: "ERROR"; message: string };
```

**Type alignment:** Use `camelCase` for field names (matches backend's `by_alias=True` serialization).

### 6. Handle in GameContext (`frontend/src/contexts/GameContext.tsx`)

Add a case in the `ws.onmessage` switch:

```typescript
switch (data.type) {
  // ... existing cases
  case "YOUR_MESSAGE_TYPE":
    // Handle the message — update local state, emit to components, etc.
    console.log(`Received: ${data.someField}`);
    break;
}
```

### 7. Expose an Action (if sending from client)

If this is a **client → server** message, add a send function:

```typescript
const sendYourAction = useCallback(
  (someField: string, anotherField: number) => {
    sendMessage({ type: "YOUR_MESSAGE_TYPE", someField, anotherField });
  },
  [sendMessage]
);
```

Add it to the context interface and value object.

## Testing

### 8. Integration Test (`backend/tests/integration/test_websocket.py`)

Add a test covering the full flow:

```python
def test_your_new_message(self, client: TestClient):
    room_id = client.post("/api/rooms").json()["roomId"]
    client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Alice"})

    with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
        ws.receive_json()  # consume initial ROOM_STATE
        ws.send_json({"type": "YOUR_MESSAGE_TYPE", "someField": "test", "anotherField": 42})
        msg = ws.receive_json()
        # Assert expected state change
```

## Summary

**7 steps total:** backend model → union type → handler routing → orchestrator logic → frontend type → context switch → (optional) context action.

The pattern is identical for all message types — only the validation logic and state mutation differ.

If your new message affects the room state broadcast (most do), you'll also need to update:
- **Backend state model:** [`backend/src/app/models/state.py`](backend/src/app/models/state.py) — Add fields to `RoomStateData`
- **Frontend state type:** [`frontend/src/types/index.ts`](frontend/src/types/index.ts) — Add matching fields to `RoomState`

See the `type-system-alignment` skill for naming conventions.

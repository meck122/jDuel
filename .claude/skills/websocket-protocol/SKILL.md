---
name: websocket-protocol
description: WebSocket messages, connection lifecycle, state synchronization.
---

## Connection Flow

1. **HTTP pre-register:** `POST /api/rooms/:roomId/join`
2. **WebSocket connect:** `ws://localhost:8000/ws?roomId=X&playerId=Y`
3. **Server validates:** Player pre-registered, room exists, not already connected
4. **Broadcast:** Server sends ROOM_STATE on every state change

## Message Types

### Client → Server

**START_GAME** - Any player starts game from lobby

```json
{ "type": "START_GAME" }
```

**ANSWER** - Submit answer for current question

```json
{ "type": "ANSWER", "answer": "Paris" }
```

**UPDATE_CONFIG** - Host updates lobby settings (waiting phase only)

```json
{ "type": "UPDATE_CONFIG", "config": { "multipleChoiceEnabled": true } }
```

**REACTION** - Fire a reaction (results/finished phase only)

```json
{ "type": "REACTION", "reactionId": 0 }
```

### Server → Client

**ROOM_STATE** - Broadcast current state (sent on every change)

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 1500, "Bob": 750 },
    "status": "playing",
    "questionIndex": 2,
    "totalQuestions": 10,
    "hostId": "Alice",
    "config": { "multipleChoiceEnabled": false, "difficulty": "enjoyer" },
    "reactions": [{ "id": 0, "label": "nice try! >:)" }, { "id": 1, "label": "ez 😎" }],
    "currentQuestion": { "text": "...", "category": "...", "options": null },
    "timeRemainingMs": 15000
  }
}
```

**REACTION** - Broadcast when a player fires a reaction (bypasses ROOM_STATE)

```json
{ "type": "REACTION", "playerId": "Alice", "reactionId": 0 }
```

**ERROR** - Action error

```json
{ "type": "ERROR", "message": "Game already started" }
```

**ROOM_CLOSED** - Room deleted, redirect to home

```json
{ "type": "ROOM_CLOSED", "reason": "Game finished - room closing" }
```

## Close Codes

- **4003** - Player not pre-registered via HTTP
- **4004** - Room not found
- **4009** - Already connected (prevents hijacking)

## State Synchronization

**Server authority:** All game logic on backend, clients display state
**Timer sync:** Server manages timers, client interpolates for smooth countdown
**Broadcast pattern:** Every state change → ROOM_STATE to all players

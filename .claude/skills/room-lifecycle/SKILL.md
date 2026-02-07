---
name: room-lifecycle
description: Room creation → lobby → game → cleanup flow and reconnection.
---

## Lifecycle States

```
CREATE → WAITING → PLAYING → RESULTS → PLAYING → ... → FINISHED → DELETED
```

## Phase Transitions

1. **CREATE** - `POST /api/rooms` → Generate 4-char code
2. **WAITING (Lobby)** - Players join via HTTP, WebSocket connects
3. **START_GAME** - Any player sends message → Load questions, start timer
4. **PLAYING** - 15s question timer, players answer
5. **RESULTS** - Show correct answer, 10s timer
6. **Next question** - Or if last question → FINISHED
7. **FINISHED** - Winner announced, 60s timer → ROOM_CLOSED → DELETE

## Key Behaviors

**Immediate cleanup:** Empty rooms (no active connections) deleted immediately
**Reconnection:** Player identity persists after WebSocket disconnect
**Timer management:** Always cancel timers on state transition
**Retry logic:** Frontend retries HTTP join 4x with 500ms delay (handles reconnection race)

## Cleanup Triggers

1. All players disconnect → Delete immediately
2. Game finishes → 60s grace period → ROOM_CLOSED → Delete
3. Timer cancellation on disconnect/delete (prevent leaks)

## Reconnection Flow

1. Player disconnects (WebSocket closes)
2. Backend detaches connection, keeps player in room
3. Player refreshes page → HTTP join (allows same name) → WebSocket reconnects
4. Server broadcasts current ROOM_STATE → Player resumes

## Deep Linking

`/room/AB3D` → Redirects to `/?join=AB3D` → Prefills join form

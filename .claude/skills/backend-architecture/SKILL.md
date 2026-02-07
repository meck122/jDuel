---
name: backend-architecture
description: Service container, orchestration, two-phase HTTP/WebSocket connection.
---

## Service Container Pattern

All services initialized once at startup ([container.py](backend/src/app/services/container.py)):

```python
@dataclass
class ServiceContainer:
    room_repository, connection_manager, room_manager
    answer_service, game_service, timer_service
    orchestrator: GameOrchestrator
```

Injected via FastAPI: `Services = Annotated[ServiceContainer, Depends(get_services)]`

## Two-Phase Connection

**Phase 1: HTTP** - Establish player identity

- `POST /api/rooms/:roomId/join` → Validates room exists, name unique, game not started
- Returns: 404 (not found), 409 (name taken / game started), 200 (success)

**Phase 2: WebSocket** - Real-time communication

- `ws://localhost:8000/ws?roomId=X&playerId=Y`
- Validates player pre-registered via HTTP
- Close codes: 4003 (not registered), 4004 (not found), 4009 (already connected)

## Orchestration Pattern

[GameOrchestrator](backend/src/app/services/orchestration/orchestrator.py) coordinates all game flow. Message routing happens in `websocket_handler.py`, which calls the appropriate orchestrator method directly:

- `handle_player_connect()` - Attach WebSocket, broadcast state
- `handle_start_game()` - Validate and transition to playing phase
- `handle_answer()` - Score submission, advance when all players answered
- `handle_config_update()` - Apply host config changes (waiting phase only)
- `handle_reaction()` - Validate and broadcast REACTION (results/finished only)
- `handle_disconnect()` - Detach connection, cleanup if room empty
- `_broadcast_room_state()` - Send ROOM_STATE to all players

## Facade Pattern

RoomManager wraps RoomRepository (identity) + ConnectionManager (WebSockets)

## State Builder

[StateBuilder](backend/src/app/services/orchestration/state_builder.py) constructs RoomStateData messages (Pydantic → JSON)

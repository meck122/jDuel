# TODO-006 [P1] No Global Room Cap or Per-Room Player Cap

## Status: Pending

## Problem

There is no limit on the number of rooms that can be created or the number of players that can join a single room. An attacker can exhaust server memory by:
- Creating thousands of rooms via POST /api/rooms
- Joining hundreds of players into one room

On a 4GB VPS, this is a realistic DoS vector.

## Affected Files

- `backend/src/app/services/core/room_repository.py:35-48` — `create()` stores room with no limit check
- `backend/src/app/services/core/room_repository.py:100-112` — `register_player()` adds to `room.players` with no cap
- `backend/src/app/services/core/room_manager.py:73-88` — `create_room()` wrapper
- `backend/src/app/api/routes.py:126-242` — join endpoint with no player cap
- `backend/src/app/config/game.py` — add `MAX_ROOMS` and `MAX_PLAYERS_PER_ROOM` constants here

## Fix

Add caps in `game.py`:

```python
MAX_ROOMS = 100            # global room limit
MAX_PLAYERS_PER_ROOM = 20  # per-room player limit
```

Enforce in `room_manager.py`:

```python
def create_room(self, ...):
    if len(self.rooms) >= MAX_ROOMS:
        raise RoomLimitExceeded("Server at capacity")

def add_player(self, room_id, ...):
    if len(room.players) >= MAX_PLAYERS_PER_ROOM:
        raise RoomFull("Room is full")
```

Return appropriate HTTP 429/403 responses.

## Impact

- **Severity:** Memory exhaustion DoS on 4GB VPS
- **Fix complexity:** Low — add two checks
- **Risk:** None

## Testing

- Test room creation at capacity
- Test player join at room limit

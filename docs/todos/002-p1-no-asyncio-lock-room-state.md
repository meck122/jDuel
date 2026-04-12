# TODO-002 [P1] No asyncio.Lock on Room State

## Status: Pending

## Problem

Room state mutations (start game, submit answer, advance phase) have no `asyncio.Lock`. If two coroutines interleave (e.g., two players answer simultaneously, or a timer fires while an answer is being processed), the room can enter an inconsistent state — double phase transitions, duplicate score awards, or skipped questions.

## Affected Files

- `backend/src/app/models/game.py:24-137` — `Room` dataclass with unguarded mutable fields
- `backend/src/app/services/orchestration/orchestrator.py:184-258` — concurrent `handle_answer`, `handle_config_update`, `handle_reaction`
- `backend/src/app/services/core/room_repository.py:35-112` — room storage with no synchronization

## Fix

Add a per-room `asyncio.Lock`:

```python
# In Room model or RoomManager
room_locks: dict[str, asyncio.Lock] = {}

async def get_lock(self, room_id: str) -> asyncio.Lock:
    if room_id not in self.room_locks:
        self.room_locks[room_id] = asyncio.Lock()
    return self.room_locks[room_id]
```

Then wrap all state-mutating orchestrator methods:

```python
async with await self.get_lock(room_id):
    # mutate state
```

Clean up locks when rooms are deleted.

## Impact

- **Severity:** Latent correctness bug, surfaces under concurrent load
- **Fix complexity:** Medium — need to identify all mutation points
- **Risk:** Low if locks are per-room (no global contention)

## Testing

- Add concurrent answer submission tests
- Verify no double phase transitions under load

# TODO-020 [P2] TOCTOU Race in Player Registration

## Status: Pending

## Problem

The HTTP join endpoint (`POST /api/rooms/{id}/join`) checks if a name is taken, then registers the player — in two separate steps without atomicity. Two players with the same name can both pass the check before either is registered, resulting in duplicate names.

Since FastAPI runs sync handlers in a thread pool, this is a real concurrency issue, not just theoretical.

## Affected Files

- `backend/src/app/api/routes.py:126-242` — check at line 172 (`request.playerId in room.players`) and register at line 228 (`register_player()`) are not atomic

## Fix

Use a lock (threading.Lock for sync code, or asyncio.Lock if made async) around the check-and-register:

```python
with self._registration_lock:
    if name in room.registered_names:
        raise NameTaken()
    room.registered_names.add(name)
```

This is related to TODO-002 (room-level asyncio locks) — can be solved together.

## Impact

- **Severity:** Duplicate player names possible under concurrent requests
- **Fix complexity:** Low — add lock around check-and-register

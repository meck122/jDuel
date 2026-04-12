# TODO-009 [P2] broadcast() Iterates Dict Without Snapshot

## Status: Pending

## Problem

The `broadcast()` method iterates over the players/connections dict directly. If a player disconnects mid-broadcast (dict mutation during iteration), it raises `RuntimeError: dictionary changed size during iteration`. Additionally, a slow client's `send()` blocks the loop for all remaining players.

## Affected Files

- `backend/src/app/services/core/connection_manager.py:70-88` — `broadcast()` iterates `room.connections.items()` at line 81 without snapshot

## Fix

1. Snapshot the dict before iterating: `list(connections.items())`
2. Use `asyncio.gather()` with `return_exceptions=True` so one slow/failed send doesn't block others:

```python
async def broadcast(self, room_id: str, message: dict):
    connections = list(self.get_connections(room_id).items())
    await asyncio.gather(
        *(self._safe_send(ws, message) for _, ws in connections),
        return_exceptions=True
    )
```

## Impact

- **Severity:** Intermittent crash during broadcasts if a player disconnects at the wrong moment
- **Fix complexity:** Low

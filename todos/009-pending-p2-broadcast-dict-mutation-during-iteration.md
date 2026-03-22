---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, backend, concurrency, websocket]
dependencies: []
---

# broadcast() Iterates connections Dict Without Snapshot — Mutation Risk + Sequential Stalls

## Problem Statement

Two related issues in `ConnectionManager.broadcast`:
1. The dict is iterated without a snapshot. If a disconnect fires mid-broadcast, `del room.connections[player_id]` mutates the dict during iteration, raising `RuntimeError`.
2. `send_json` is awaited sequentially. A single stalled WebSocket (slow mobile client, congested link) blocks delivery to all subsequent players in the room.

## Findings

- File: `backend/src/app/services/core/connection_manager.py` lines 81–88
- `room_closer.py` already uses `list(room.connections.items())` correctly — inconsistency
- Exception handling swallows failures but doesn't remove dead sockets from `connections`, causing stale entries and repeated log warnings

## Proposed Solutions

### Option A: Snapshot + asyncio.gather (Recommended)
```python
async def broadcast(self, room: Room, state: dict) -> None:
    connections = list(room.connections.items())  # snapshot
    results = await asyncio.gather(
        *[ws.send_json(state) for _, ws in connections],
        return_exceptions=True
    )
    for (player_id, _), result in zip(connections, results):
        if isinstance(result, Exception):
            logger.warning("Broadcast failed for %s: %s", player_id, result)
```
- **Pros:** Parallel delivery; snapshot prevents mutation-during-iteration.
- **Effort:** Small | **Risk:** Low

### Option B: Snapshot only (no parallelism)
- Take `list(room.connections.items())` before iterating, keep sequential sends.
- **Pros:** Fixes mutation bug; simpler diff.
- **Cons:** Doesn't fix stall problem.
- **Effort:** Small | **Risk:** Very low

## Acceptance Criteria
- [ ] `broadcast` takes a snapshot of connections before iterating
- [ ] Failed sends don't block successful sends to other players
- [ ] Dead socket entries are removed or flagged for removal on send failure

## Work Log
- 2026-03-22: Identified by `kieran-python-reviewer`, `performance-oracle`, `architecture-strategist`

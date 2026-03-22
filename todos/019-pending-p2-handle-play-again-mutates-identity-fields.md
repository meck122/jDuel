---
status: pending
priority: p2
issue_id: "019"
tags: [code-review, architecture, backend]
dependencies: []
---

# Orchestrator Directly Mutates Identity-Layer Room Fields in handle_play_again

## Problem Statement

`handle_play_again` directly assigns `room.players`, `room.scores`, and `room.session_tokens` via dict comprehensions in the orchestrator. This is the only place where identity/connection-layer fields are mutated outside of `RoomRepository` or `ConnectionManager`, breaking the service boundary contract the rest of the layer maintains. Also creates a mutation hazard if called while `broadcast` is iterating `room.connections`.

## Findings

- File: `backend/src/app/services/orchestration/orchestrator.py` lines 166–175
- `GameService.reset_game_state` explicitly notes "Does NOT touch connection-layer fields — player pruning is handled by the orchestrator"
- The comment confirms this is deliberate but architecturally inconsistent

## Proposed Solution

Move pruning logic to `RoomManager.prune_disconnected_players(room_id)`:
```python
def prune_disconnected_players(self, room_id: str) -> None:
    room = self._repository.get(room_id)
    connected = set(room.connections.keys())
    room.players = {p for p in room.players if p in connected}
    room.scores = {p: s for p, s in room.scores.items() if p in connected}
    room.session_tokens = {p: t for p, t in room.session_tokens.items() if p in connected}
```
Orchestrator calls `self._room_manager.prune_disconnected_players(room_id)` — consistent with how all other identity mutations are delegated.

## Acceptance Criteria
- [ ] No direct mutation of `room.players`, `room.scores`, `room.session_tokens` in `orchestrator.py`
- [ ] Pruning delegated to `RoomManager` or `RoomRepository`
- [ ] `handle_play_again` behavior unchanged

## Work Log
- 2026-03-22: Identified by `architecture-strategist` review agent

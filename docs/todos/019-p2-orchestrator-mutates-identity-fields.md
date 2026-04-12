# TODO-019 [P2] Orchestrator Mutates Identity-Layer Room Fields

## Status: Pending

## Problem

The `handle_play_again` logic in the orchestrator directly mutates Room identity-layer fields (e.g., resetting game state, clearing scores) that should only be managed by the RoomManager or GameService. This breaks the service boundary and makes state management harder to reason about.

## Affected Files

- `backend/src/app/services/orchestration/orchestrator.py:135-182` — `handle_play_again()` directly mutates `room.players` (line 167), `room.scores` (line 168), `room.session_tokens` (line 171)

## Fix

Move Room field mutations into appropriate service methods:

```python
# Instead of orchestrator doing:
room.game_status = GameStatus.LOBBY
room.current_question = 0
room.scores = {}

# Delegate to service:
self.game_service.reset_game(room)
```

## Impact

- **Severity:** Architecture violation, harder to maintain
- **Fix complexity:** Medium — requires refactoring mutation logic into services

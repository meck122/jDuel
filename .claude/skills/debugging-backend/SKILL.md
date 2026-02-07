---
name: debugging-backend
description: Tracing state bugs through the orchestrator, common failure patterns, and runtime inspection. Use when debugging game state issues, timer problems, or WebSocket connection errors.
---

# Debugging Backend

Guide for tracing state bugs, understanding error patterns, and inspecting runtime behavior.

## State Mutation Flow

All game state flows through the orchestrator. To trace a state bug, follow the mutation chain:

```
websocket_handler.py (routing)
  → orchestrator.py (coordination + validation)
    → game_service.py (scoring logic)
    → room_manager.py (room state + connections)
    → timer_service.py (async timers)
  → state_builder.py (serialize Room → RoomStateData)
  → broadcast to all connections
```

**Key principle:** The `Room` object in `room_repository` is the single source of truth. `RoomStateData` is a read-only projection built by `StateBuilder`.

## Key Logging Points

All services use `logger = logging.getLogger(__name__)`. Enable debug logging to see the full flow:

| File | What it logs |
|------|-------------|
| `orchestrator.py` | Phase transitions, player connect/disconnect, timer starts/cancels, config updates |
| `room_manager.py` | Room creation, player registration, question loading, room deletion |
| `game_service.py` | Answer scoring, round advancement |
| `websocket_handler.py` | Message routing, validation errors, connection lifecycle |
| `state_builder.py` | Out-of-bounds `question_index` errors |
| `timer_service.py` | Timer start/cancel/fire events |

## Common State Bugs

### Timer not canceling

**Symptom:** Game advances unexpectedly after a phase transition.

**Cause:** Timer callback fires after state has moved on. Check that `timer_service.cancel_question_timer()` or `cancel_results_timer()` is called before the transition.

**Where to look:** `orchestrator.py` — every method that changes `room.status` should cancel the relevant timer first.

### Stale `question_index`

**Symptom:** Wrong question displayed, or `IndexError` on `room.questions[room.question_index]`.

**Cause:** `question_index` incremented without checking bounds. `state_builder.py` now has bounds guards that log errors and return empty state rather than crashing.

**Where to look:** `game_service.py` — `advance_question()` increments `question_index`. Verify it checks `>= len(room.questions)` before advancing.

### Connections not cleared on disconnect

**Symptom:** Broadcasts fail silently, room not cleaned up when last player leaves.

**Cause:** `handle_disconnect()` must remove the WebSocket from `connection_manager` AND check if the room is empty.

**Where to look:** `orchestrator.py:handle_disconnect()` → `room_manager.remove_connection()` → `connection_manager.remove()`.

### Room not deleted after game over

**Symptom:** Stale rooms accumulate in memory.

**Cause:** The 60s game-over timer fires `room_closer.close_room()`. If it's canceled or errors out, the room persists.

**Where to look:** `orchestrator.py:_handle_game_over()` starts the cleanup timer. `room_closer.close_room()` broadcasts `ROOM_CLOSED` and deletes the room.

## Inspecting Room State

To inspect a Room object's current state, log these key fields:

```python
room = room_manager.get_room(room_id)
logger.debug(
    f"Room {room.room_id}: status={room.status.value}, "
    f"question_index={room.question_index}/{len(room.questions)}, "
    f"players={list(room.scores.keys())}, "
    f"connections={room_manager.get_connection_count(room_id)}, "
    f"answers_received={list(room.player_answers.keys())}"
)
```

Key Room fields:
- `room.status` — `GameStatus` enum (WAITING, PLAYING, RESULTS, FINISHED)
- `room.question_index` — current question (0-indexed)
- `room.questions` — loaded `Question` objects
- `room.scores` — `dict[str, int]` player scores
- `room.player_answers` — `dict[str, str]` current round answers
- `room.question_points` — `dict[str, int]` points earned this round
- `room.host_id` — first registered player
- `room.session_tokens` — `dict[str, str]` for reconnection auth
- `room.config` — `RoomConfig` (multiple_choice_enabled, difficulty)

## WebSocket Close Codes

| Code | Meaning | Sent When |
|------|---------|-----------|
| `4003` | Not pre-registered | Player tries to connect via WebSocket without HTTP pre-registration |
| `4004` | Room not found | Room ID doesn't exist in `room_repository` |
| `4009` | Already connected | Another WebSocket is already open for this player (prevents hijacking) |

These are sent by `websocket_handler.py` before the WebSocket is accepted (pre-accept close).

## Key Files

| File | Role |
|------|------|
| `backend/src/app/services/orchestration/orchestrator.py` | Central coordinator — start here |
| `backend/src/app/services/core/room_manager.py` | Room + connection management |
| `backend/src/app/services/core/game_service.py` | Scoring and round advancement |
| `backend/src/app/services/core/timer_service.py` | Async question/results/cleanup timers |
| `backend/src/app/services/orchestration/state_builder.py` | Room → JSON serialization |
| `backend/src/app/api/websocket_handler.py` | Message routing and connection lifecycle |
| `backend/src/app/models/game.py` | Room, Question, GameStatus models |
| `backend/src/app/config/game.py` | Timing constants, reactions config |

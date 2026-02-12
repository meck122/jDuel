---
title: "feat: Add Play Again button to reset room to lobby"
type: feat
date: 2026-02-11
brainstorm: docs/brainstorms/2026-02-11-play-again-feature-brainstorm.md
---

# feat: Add Play Again button to reset room to lobby

## Overview

After a game ends, the host sees a "Play Again" button on the GameOver screen. Clicking it sends a `PLAY_AGAIN` WebSocket message, which resets the room back to the lobby (`waiting` state). All connected players return to the lobby, scores reset to zero, disconnected players are pruned, and new players can join via the room link. The host can reconfigure settings before starting the next game.

## Key Decisions

- **Trigger:** Host-only "Play Again" button on GameOver screen (follows `START_GAME` pattern)
- **Reset scope:** Scores to 0, clear questions/answers/round state, status → `waiting`
- **Disconnected players:** Pruned from `room.players` in the orchestrator during reset (mitigates `all_players_answered` at game boundaries — mid-game disconnects are a pre-existing issue handled by the question timer)
- **Config:** Preserved across Play Again (host can change in lobby)
- **Room link:** Stays active, new players can join after reset
- **Timer:** 60-second game-over cleanup timer is cancelled on Play Again

## State Transition

```
FINISHED --[PLAY_AGAIN (host only)]--> WAITING
```

The existing 60-second game-over timer that would delete the room must be cancelled **before** the state reset.

## Implementation

### Step 1: Backend — Add `PlayAgainMessage` model

**File:** `backend/src/app/models/websocket_messages.py`

```python
class PlayAgainMessage(BaseModel):
    type: Literal["PLAY_AGAIN"]
```

Add `"PLAY_AGAIN"` to the `WebSocketClientMessage.type` union literal.

### Step 2: Backend — Add handler routing

**File:** `backend/src/app/api/websocket_handler.py` (~line 111)

Add `elif msg_type == "PLAY_AGAIN":` branch, validate with `PlayAgainMessage.model_validate(message)`, delegate to `orchestrator.handle_play_again(room_id, player_id)`.

### Step 3: Backend — Add `reset_game_state()` on GameService

**File:** `backend/src/app/services/core/game_service.py`

New method `reset_game_state(room)` that resets **game-related fields only** (no connection-layer logic):

- `room.status = GameStatus.WAITING`
- `room.question_index = 0`
- `room.questions = []` (fresh questions load at next `START_GAME`)
- Reset all player scores to 0: `room.scores = {pid: 0 for pid in room.scores}`
- `room.current_round = RoundState()`
- `room.finish_time = None`
- `room.results_start_time = None`
- `room.last_reaction_times = {}`

**Preserve:** `room_id`, `host_id`, `config`, `connections`, `players`, `session_tokens`

Note: `GameService` never inspects `room.connections` — player pruning is a connection-layer concern handled by the orchestrator (Step 4).

### Step 4: Backend — Add `handle_play_again()` on Orchestrator

**File:** `backend/src/app/services/orchestration/orchestrator.py`

```python
async def handle_play_again(self, room_id: str, player_id: str) -> None:
    room = self._room_manager.get_room(room_id)
    if not room:
        return

    if player_id != room.host_id:
        logger.warning(f"Non-host play again rejected: room_id={room_id}")
        return

    if room.status != GameStatus.FINISHED:
        logger.warning(f"Play again in wrong state: room_id={room_id}, status={room.status}")
        return

    # Cancel game-over timer FIRST (prevents room deletion race)
    self._timer_service.cancel_all_timers_for_room(room_id)

    # Prune disconnected players (connection-layer concern, lives here not in GameService)
    connected_ids = set(room.connections.keys())
    room.players = {pid for pid in room.players if pid in connected_ids}
    room.scores = {pid: score for pid, score in room.scores.items() if pid in connected_ids}
    room.session_tokens = {pid: token for pid, token in room.session_tokens.items() if pid in connected_ids}

    # Reset game state (pure game-rules concern)
    self._game_service.reset_game_state(room)

    logger.info(f"Play again: room_id={room_id}, resetting to lobby")

    # Broadcast fresh state — frontend auto-renders Lobby
    await self._broadcast_room_state(room_id)
```

**Edge case — host disconnect:** If the host disconnects but other players remain, nobody can trigger Play Again. Those players see "Waiting for host..." until the 60-second timer closes the room. This matches existing lobby behavior where only the host can start a game.

### Step 5: Frontend — Add `playAgain` action to GameContext

**File:** `frontend/src/contexts/GameContext.tsx`

Add to `GameContextValue` interface:

```typescript
playAgain: () => void;
```

Implement (same pattern as `startGame`):

```typescript
const playAgain = useCallback(() => {
  sendMessage({ type: "PLAY_AGAIN" });
}, [sendMessage]);
```

Also add `playAgain` to the provider `value` object alongside `startGame`, `submitAnswer`, etc.

No new `case` needed in `ws.onmessage` — the server responds with a `ROOM_STATE` broadcast (status: `"waiting"`), which is already handled.

### Step 6: Frontend — Add Play Again button to GameOver

**File:** `frontend/src/features/game/GameOver/GameOver.tsx`

Update `useGame()` destructuring to include `playerId` and `playAgain`, then add host detection and conditional rendering:

```tsx
const { roomState, playerId, playAgain } = useGame();
const isHost = roomState?.hostId === playerId;

{/* Replace or augment the timer section */}
{isHost ? (
  <button onClick={playAgain} className={styles.playAgainButton}>
    Play Again
  </button>
) : (
  <p className={styles.waitingText}>Waiting for host to start a new game...</p>
)}
```

Keep the "Room closing in" timer visible for both host and non-host — it provides useful context about what happens if nobody acts.

**File:** `frontend/src/features/game/GameOver/GameOver.module.css`

Add styles for `.playAgainButton` and `.waitingText` following existing button patterns.

### Step 7: Update EventProtocol.md

**File:** `docs/EventProtocol.md`

Add `PLAY_AGAIN` to the client→server messages table:

| Message | Payload | Validation | Response |
|---------|---------|------------|----------|
| `PLAY_AGAIN` | `{ type: "PLAY_AGAIN" }` | Host only, `finished` status | `ROOM_STATE` with `status: "waiting"` |

### Step 8: Tests

**File:** `backend/tests/unit/test_game_service.py`
- Test `reset_game_state()` resets all game fields correctly (status, scores, questions, round state, timestamps)
- Test config is preserved across reset

**File:** `backend/tests/unit/test_orchestrator.py`
- Test host-only enforcement (non-host rejected)
- Test status guard (only works in `finished`)
- Test timer cancellation happens before reset
- Test room-not-found returns gracefully
- Test disconnected players are pruned from `players`, `scores`, `session_tokens`
- Test broadcast is called after reset
- **Test full Play Again → Start Game cycle** (validates reset leaves room in valid state for a second game)

**File:** `backend/tests/integration/test_websocket.py`
- Full flow: game ends → host sends PLAY_AGAIN → all clients receive `waiting` state
- New player can join after reset
- Multiple consecutive Play Again cycles work correctly

## Acceptance Criteria

- [ ] Host sees "Play Again" button on GameOver screen
- [ ] Non-host sees "Waiting for host..." text
- [ ] Clicking Play Again returns all connected players to the lobby
- [ ] Scores reset to zero
- [ ] Disconnected players are removed from the room
- [ ] Room link works for new players after reset
- [ ] Host can reconfigure settings and start a new game
- [ ] 60-second cleanup timer is cancelled (room is not deleted)
- [ ] Non-host PLAY_AGAIN messages are rejected
- [ ] PLAY_AGAIN in non-finished states is rejected
- [ ] Multiple consecutive Play Again cycles work correctly

## Race Condition: PLAY_AGAIN vs. Game-Over Timer

If the 60-second timer fires before PLAY_AGAIN is processed, `room_closer.close_room()` deletes the room. The PLAY_AGAIN handler's `get_room()` returns `None` and exits gracefully. The client receives `ROOM_CLOSED` from the timer and redirects to home. No special handling needed — existing patterns cover this.

## Files Modified

| File | Change |
|------|--------|
| `backend/src/app/models/websocket_messages.py` | Add `PlayAgainMessage`, update union |
| `backend/src/app/api/websocket_handler.py` | Add `PLAY_AGAIN` routing |
| `backend/src/app/services/core/game_service.py` | Add `reset_game_state()` method |
| `backend/src/app/services/orchestration/orchestrator.py` | Add `handle_play_again()` method |
| `frontend/src/contexts/GameContext.tsx` | Add `playAgain` action |
| `frontend/src/features/game/GameOver/GameOver.tsx` | Add Play Again button (host-only) |
| `frontend/src/features/game/GameOver/GameOver.module.css` | Button styles |
| `docs/EventProtocol.md` | Document PLAY_AGAIN message |
| `backend/tests/unit/test_game_service.py` | Tests for reset_game_state |
| `backend/tests/unit/test_orchestrator.py` | Tests for handle_play_again |
| `backend/tests/integration/test_websocket.py` | Integration test |

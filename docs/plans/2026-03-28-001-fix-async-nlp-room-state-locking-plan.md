---
title: "fix: Async NLP answer verification + per-room state locking"
type: fix
status: active
date: 2026-03-28
origin: docs/brainstorms/2026-03-28-async-nlp-room-locks-requirements.md
---

# fix: Async NLP answer verification + per-room state locking

## Overview

Two tightly coupled P1 issues shipping as one change:

1. **TODO-001**: `AnswerService.is_correct()` blocks the asyncio event loop for 50-500ms per answer (spaCy + sentence-transformers). Every WebSocket connection freezes.
2. **TODO-002**: No concurrency control on room state mutations. Once 001 introduces `await` inside `handle_answer`, interleaved coroutines can corrupt room state (double scoring, skipped questions, duplicate phase transitions).

Fixing 001 without 002 actively worsens race conditions. They must ship together (see origin: `docs/brainstorms/2026-03-28-async-nlp-room-locks-requirements.md`).

## Problem Statement

**Event loop blocking:** On the 4GB Oracle VPS (aarch64, CPU-only), `model.encode()` takes 200-500ms. During this time, all rooms' WebSocket messages queue — timer callbacks stall, disconnects are delayed, other rooms' gameplay freezes.

**State races:** The `GameOrchestrator` has 7+ async methods that mutate room state, plus 3 timer callbacks running as independent `asyncio.Task`s. Today they can't interleave mid-mutation because no `await` exists within mutation code. After making NLP async, `handle_answer` will yield during `asyncio.to_thread()`, allowing another coroutine to enter the same room's mutation code.

## Proposed Solution

1. Add `asyncio.Lock` as a field on the `Room` dataclass (lifecycle tied to room — no cleanup needed)
2. Make `GameService.process_answer()` async, wrapping `self.answer_service.is_correct()` in `asyncio.to_thread()`
3. Acquire the per-room lock in every state-mutating orchestrator method and timer callback
4. **Snapshot-then-broadcast pattern**: build state dict inside lock, release lock, then broadcast — prevents slow WebSocket sends from blocking the room
5. **Capture answer timestamp before lock**: record `datetime.now(UTC)` in the WebSocket handler before `handle_answer`, pass it into `process_answer` for fair scoring

## Technical Approach

### Phase 1: Add lock to Room model

**File: `backend/src/app/models/game.py`**

- Add `import asyncio` at top
- Add field: `lock: asyncio.Lock` (no `field(default_factory=...)` since Room has explicit `__init__`)
- Initialize in `__init__`: `self.lock = asyncio.Lock()`
- Exclude from any repr/logging by convention (asyncio.Lock is not serializable)

### Phase 2: Make process_answer async

**File: `backend/src/app/services/core/game_service.py`**

```python
# game_service.py — process_answer becomes async
async def process_answer(
    self, room: Room, player_id: str, answer: str, answer_time: datetime | None = None
) -> bool:
    # Duplicate check (sync, fast)
    if player_id in room.answered_players:
        return False
    if not room.questions or room.question_index >= len(room.questions):
        return False

    room.answered_players.add(player_id)
    room.player_answers[player_id] = answer

    current_question = room.questions[room.question_index]

    if room.config.multiple_choice_enabled:
        correct = answer == current_question.answer
    else:
        # Offload blocking NLP to thread pool
        correct = await asyncio.to_thread(
            self.answer_service.is_correct, answer, current_question.answer
        )

    if correct:
        room.correct_players.add(player_id)
        # Use pre-lock timestamp if provided, else fallback to now
        ref_time = answer_time or datetime.now(UTC)
        elapsed_ms = int((ref_time - room.question_start_time).total_seconds() * 1000)
        if elapsed_ms <= QUESTION_TIME_MS:
            correct_count = len(room.correct_players) - 1
            score = self._calculate_score(correct_count)
            room.scores[player_id] += score
            room.question_points[player_id] = score
        else:
            room.question_points[player_id] = 0
    else:
        room.question_points[player_id] = 0

    return correct
```

Key decisions:
- `AnswerService.is_correct()` stays synchronous (R4 from origin doc) — it's the callable passed to `to_thread`
- `answer_time` parameter added for score fairness — defaults to `None` for backward compat with tests
- Multiple-choice path stays synchronous (string comparison, no thread needed)

### Phase 3: Lock all orchestrator mutations — snapshot-then-broadcast

**File: `backend/src/app/services/orchestration/orchestrator.py`**

Every public `handle_*` method and timer callback follows this pattern:

```python
async def handle_answer(self, room_id, player_id, answer, answer_time=None):
    room = self._room_manager.get_room(room_id)
    if not room:
        return

    state_snapshot = None
    async with room.lock:
        if room.status != GameStatus.PLAYING:
            return

        await self._game_service.process_answer(room, player_id, answer, answer_time)

        if self._game_service.all_players_answered(room):
            self._timer_service.cancel_all_timers_for_room(room_id)
            self._game_service.show_results(room)
            self._start_results_timer(room_id)

        state_snapshot = self._state_builder.build_room_state(room)

    # Broadcast OUTSIDE the lock — slow WS sends won't block the room
    if state_snapshot:
        await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())
```

**Methods requiring the lock + snapshot-then-broadcast refactor:**

| Method | Lock needed | Notes |
|--------|-------------|-------|
| `handle_connect` | Yes | Attaches WebSocket, broadcasts |
| `handle_start_game` | Yes | Loads questions, starts game, broadcasts |
| `handle_play_again` | Yes | Prunes players, resets state, broadcasts |
| `handle_answer` | Yes | Mutates scores via async NLP, may transition to results |
| `handle_config_update` | Yes | Modifies room config, broadcasts |
| `handle_reaction` | Yes | Mutates `last_reaction_times`, broadcasts reaction |
| `handle_disconnect` | Yes | Detaches connection, may delete room |
| `_on_question_timeout` | Yes | May transition to results |
| `_on_results_timeout` | Yes | Advances question or finishes game |
| `_on_game_over_timeout` | Yes | Closes room |

**Critical: no re-entrant locking.** `_transition_to_results` is currently called from within locked methods. Inline its logic (show_results + start timer + build snapshot) rather than calling it as a separate method that might try to acquire the lock.

### Phase 4: Capture answer timestamp in WebSocket handler

**File: `backend/src/app/api/websocket_handler.py`**

```python
# In the ANSWER case of the message dispatch loop:
elif msg_type == "ANSWER":
    answer_time = datetime.now(UTC)  # Before lock acquisition
    await orchestrator.handle_answer(
        room_id, player_id, validated.answer, answer_time=answer_time
    )
```

This decouples score timing from lock queuing — a player who answered quickly but waited behind another player's NLP call gets scored at their actual answer time.

### Phase 5: Update tests

**File: `backend/tests/unit/test_game_service.py`**

- All `TestGameService` test methods: `def test_*` -> `async def test_*`
- All `game_service.process_answer(...)` calls: add `await`
- `asyncio_mode = "auto"` is already in `pyproject.toml`, so no config change needed

**File: `backend/tests/unit/test_orchestrator.py`**

- No structural changes needed — tests already `await` orchestrator methods
- The lock is acquired/released transparently within orchestrator calls
- MockAnswerService is synchronous — `asyncio.to_thread(mock.is_correct, ...)` works fine

**New test: concurrent answer race condition**

```python
async def test_concurrent_answers_no_double_scoring(self):
    """Two players answering simultaneously should not corrupt state."""
    # Setup: room with 2 players, game started
    # Submit both answers concurrently using asyncio.gather
    # Verify: both scores recorded, results transition happens exactly once
```

**New test: timer vs answer race**

```python
async def test_timer_fires_during_answer_processing(self):
    """Timer callback should wait for lock, not corrupt state."""
    # Setup: room with 2 players, 1 answers
    # Fire _on_question_timeout
    # Verify: room in RESULTS, first player's answer recorded
```

## System-Wide Impact

- **Interaction graph**: `ws.onmessage` -> `websocket_handler` -> `orchestrator.handle_*` -> acquires `room.lock` -> mutates state -> builds snapshot -> releases lock -> broadcasts. Timer callbacks follow the same lock path.
- **Error propagation**: If `asyncio.to_thread` raises (NLP model error), exception propagates up through the lock context manager — lock is released cleanly via `async with`. The orchestrator method fails, no state is corrupted (pre-mutation already happened but that's fine — player is marked as answered with 0 score).
- **State lifecycle risks**: Room deletion inside a locked method (`handle_disconnect`, `_on_game_over_timeout`) is safe because the lock is on the Room object — once the room is deleted from the repository, no new coroutine can get a reference to it or its lock.
- **API surface parity**: `register_player()` (HTTP path) is NOT covered by the lock. This is safe because it's synchronous with no yields. Add a code comment documenting this invariant.

## Acceptance Criteria

- [ ] `asyncio.Lock` field on Room model (`backend/src/app/models/game.py`)
- [ ] `GameService.process_answer()` is async, NLP offloaded via `asyncio.to_thread` (`backend/src/app/services/core/game_service.py`)
- [ ] All orchestrator mutation methods acquire per-room lock (`backend/src/app/services/orchestration/orchestrator.py`)
- [ ] Snapshot-then-broadcast: state built inside lock, broadcast outside (`orchestrator.py`)
- [ ] Answer timestamp captured before lock in WebSocket handler (`backend/src/app/api/websocket_handler.py`)
- [ ] `_transition_to_results` inlined — no re-entrant lock acquisition risk
- [ ] `register_player` has code comment explaining why it's safe without lock
- [ ] All 91 existing tests pass
- [ ] `test_game_service.py` tests converted to async
- [ ] New test: concurrent answer submission correctness
- [ ] New test: timer-vs-answer race condition
- [ ] No frontend changes required
- [ ] No WebSocket protocol changes

## Dependencies & Risks

- **Risk: Lock queuing latency.** With per-room locking and 200-500ms NLP per answer, the Nth player waits up to (N-1)*500ms. Mitigated by answer_time parameter (score fairness) and by the fact this is still better than the status quo (blocking entire event loop). Max 20 players per room (enforced by fix 006).
- **Risk: Deadlock from re-entrant lock.** `asyncio.Lock` is not reentrant. Mitigated by inlining `_transition_to_results` and ensuring no locked method calls another locked method.
- **Dependency:** Python 3.10+ (asyncio.Lock works without active event loop at construction). Project uses 3.13+ — no issue.
- **Dependency:** `asyncio_mode = "auto"` in pyproject.toml for test discovery of async tests.

## Known Tradeoffs

**Accepted:** Per-room lock serializes all mutations including during NLP. This is correct behavior — splitting the lock around `to_thread` would break `all_players_answered` checks and score ordering. The latency is bounded by MAX_PLAYERS_PER_ROOM (20) and is better than the status quo (entire event loop blocked).

**Accepted:** Broadcasting outside the lock means a subsequent mutation could make the broadcast slightly stale. This is acceptable — the next mutation will trigger its own broadcast with fresh state.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-28-async-nlp-room-locks-requirements.md](docs/brainstorms/2026-03-28-async-nlp-room-locks-requirements.md) — Key decisions: ship together, lock on Room model, asyncio.to_thread
- TODO-001: `docs/todos/001-p1-event-loop-blocking-nlp.md`
- TODO-002: `docs/todos/002-p1-no-asyncio-lock-room-state.md`
- Room model: `backend/src/app/models/game.py:23-85`
- GameService.process_answer: `backend/src/app/services/core/game_service.py:35-83`
- Orchestrator: `backend/src/app/services/orchestration/orchestrator.py`
- WebSocket handler: `backend/src/app/api/websocket_handler.py:68-146`
- TimerService (creates racing tasks): `backend/src/app/services/core/timer_service.py`
- MockAnswerService: `backend/tests/conftest.py:9-17`

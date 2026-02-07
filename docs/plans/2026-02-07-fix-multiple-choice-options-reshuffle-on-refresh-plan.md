---
title: Fix multiple choice options reshuffling on player refresh
type: fix
date: 2026-02-07
deepened: 2026-02-07
---

# Fix multiple choice options reshuffling on player refresh

## Enhancement Summary

**Deepened on:** 2026-02-07
**Skills applied:** testing-patterns, backend-architecture, websocket-protocol, game-flow, type-system-alignment

### Key Improvements
1. Clarified that `advance_question()` reset is **mandatory** (not just defensive) — without it, questions 2+ would show previous question's options
2. Added 6 specific test cases with code covering stability, resets, edge cases
3. Confirmed no frontend type changes needed — `CurrentQuestion.options` already typed correctly
4. Validated all game phase transitions are safe with the fix

---

## Overview

When a player refreshes their browser during a multiple choice question, the answer options get rearranged into a different order. This is confusing because a player who was about to click "B" may now find a completely different answer in that position.

## Problem Statement

In `backend/src/app/services/orchestration/state_builder.py:72-75`, the `_add_playing_state` method builds the options list fresh on every call:

```python
options = [current_question.answer, *current_question.wrong_answers]
random.shuffle(options)
```

This `build_room_state()` is called every time a ROOM_STATE message is sent — including on player reconnection after a page refresh. Since `random.shuffle` produces a new ordering each time, the options arrive in a different order.

### Research Insights

**Broadcast frequency:** `_broadcast_room_state()` is called 8 times across the orchestrator (connect, start, config update, disconnect, results transition, question timeout, results timeout x2). During a single question, multiple broadcasts happen (game start, player connect/disconnect, all-answered). Each triggers a fresh shuffle in the current code.

**All players see the same state:** The server builds one `RoomStateMessage` per broadcast and sends it to all connections. With the fix, all players will see identical option ordering since the cached `shuffled_options` is shared at the room level. This is the correct behavior for a trivia game — per-player shuffling would add complexity with no benefit.

**No concurrency concern:** Python's GIL and FastAPI's async model mean `build_room_state()` is never called concurrently for the same room. The lazy-init pattern is safe.

## Proposed Solution

Cache the shuffled options on the `RoundState` dataclass so they are computed once per question and reused on every subsequent `build_room_state()` call.

### Changes

#### 1. Add `shuffled_options` field to `RoundState` (`backend/src/app/models/round_state.py`)

```python
shuffled_options: list[str] | None = None
```

This field stores the shuffled options for the current question. It gets set once when the question starts and cleared when `advance_question()` resets the round state. Update the docstring to list this field.

#### 2. Update `StateBuilder._add_playing_state` (`backend/src/app/services/orchestration/state_builder.py`)

Replace the shuffle-every-time logic with a cache-on-first-use pattern:

```python
options = None
if room.config.multiple_choice_enabled and current_question.wrong_answers:
    if room.current_round.shuffled_options is None:
        options = [current_question.answer, *current_question.wrong_answers]
        random.shuffle(options)
        room.current_round.shuffled_options = options
    else:
        options = room.current_round.shuffled_options
```

**Architecture note:** This makes `StateBuilder` mutate the `Room`'s `RoundState`. The codebase already follows this pattern — `StateBuilder._add_playing_state` reads from `room.question_start_time`, and the orchestrator freely mutates room state. The lazy-init here is consistent with how the codebase works.

#### 3. Reset `shuffled_options` in `advance_question()` and `start_game()` (`backend/src/app/services/core/game_service.py`)

**CRITICAL: The reset in `advance_question()` is mandatory, not defensive.** Without it, questions 2+ would inherit the previous question's cached options — which contain entirely wrong answer text for the new question. The lazy-init check (`if shuffled_options is None`) would find stale data and reuse it.

Add after the existing resets in `advance_question()` (after line 108):
```python
room.current_round.shuffled_options = None
```

Add in `start_game()` alongside the other resets:
```python
room.current_round.shuffled_options = None
```

#### 4. No frontend or type changes needed

Confirmed: `CurrentQuestion` in `backend/src/app/models/state.py:22-27` already has `options: list[str] | None = None`. The frontend `RoomState` type in TypeScript already includes `options?: string[]` on `currentQuestion`. The `shuffled_options` field is internal to `RoundState` (backend-only state) and is never sent over the wire.

## Game Flow Verification

Every phase transition has been verified safe:

| Transition | What happens to `shuffled_options` | Status |
|---|---|---|
| WAITING → PLAYING (first question) | `start_game()` resets to `None`; first `build_room_state()` populates it | Safe |
| PLAYING → RESULTS | Not touched; sits inert (results phase doesn't use options) | Safe |
| RESULTS → PLAYING (next question) | `advance_question()` resets to `None`; next broadcast populates it | Safe (mandatory reset) |
| RESULTS → FINISHED | `advance_question()` resets to `None`; `_add_finished_state` ignores it | Safe |
| FINISHED → Room destroyed | Entire Room object garbage collected | Safe |
| Player reconnect during PLAYING | `build_room_state()` finds cached options, reuses them | Safe (this is the fix) |

## Acceptance Criteria

- [x] On player refresh during a multiple choice question, the options remain in the same order
- [x] Different questions still get independently shuffled options
- [x] All players in the same room see the same option ordering for each question
- [x] Existing tests pass
- [x] New test: calling `build_room_state()` twice for the same question returns identical options order
- [x] `advance_question()` resets `shuffled_options` to `None`
- [x] `start_game()` resets `shuffled_options` to `None`

## Test Plan

### Tests for `test_state_builder.py` (add to `TestStateBuilder`)

```python
def test_multiple_choice_options_stable_across_builds(
    self, state_builder: StateBuilder, sample_questions
):
    """Calling build_room_state multiple times returns the same option order."""
    room = Room("TEST1", sample_questions)
    room.players = {"Alice"}
    room.scores = {"Alice": 0}
    room.host_id = "Alice"
    room.status = GameStatus.PLAYING
    room.question_index = 2  # Has wrong_answers
    room.question_start_time = datetime.now(UTC)
    room.config.multiple_choice_enabled = True

    msg1 = state_builder.build_room_state(room)
    msg2 = state_builder.build_room_state(room)
    msg3 = state_builder.build_room_state(room)

    assert msg1.roomState.currentQuestion.options == msg2.roomState.currentQuestion.options
    assert msg2.roomState.currentQuestion.options == msg3.roomState.currentQuestion.options

def test_shuffled_options_cached_on_round_state(
    self, state_builder: StateBuilder, sample_questions
):
    """Building room state populates shuffled_options on the room's RoundState."""
    room = Room("TEST1", sample_questions)
    room.players = {"Alice"}
    room.scores = {"Alice": 0}
    room.host_id = "Alice"
    room.status = GameStatus.PLAYING
    room.question_index = 2
    room.question_start_time = datetime.now(UTC)
    room.config.multiple_choice_enabled = True

    assert room.current_round.shuffled_options is None

    state_builder.build_room_state(room)

    assert room.current_round.shuffled_options is not None
    assert len(room.current_round.shuffled_options) == 4

def test_shuffled_options_reset_produces_new_options(
    self, state_builder: StateBuilder, sample_questions
):
    """After clearing shuffled_options, new options are generated with all answers."""
    room = Room("TEST1", sample_questions)
    room.players = {"Alice"}
    room.scores = {"Alice": 0}
    room.host_id = "Alice"
    room.status = GameStatus.PLAYING
    room.question_index = 2
    room.question_start_time = datetime.now(UTC)
    room.config.multiple_choice_enabled = True

    state_builder.build_room_state(room)
    room.current_round.shuffled_options = None
    room.question_start_time = datetime.now(UTC)

    msg = state_builder.build_room_state(room)
    options = msg.roomState.currentQuestion.options

    assert options is not None
    assert len(options) == 4
    assert sample_questions[2].answer in options
    for wrong in sample_questions[2].wrong_answers:
        assert wrong in options

def test_no_options_cached_when_mc_disabled(
    self, state_builder: StateBuilder, sample_questions
):
    """When multiple choice is disabled, no shuffled_options are cached."""
    room = Room("TEST1", sample_questions)
    room.players = {"Alice"}
    room.scores = {"Alice": 0}
    room.host_id = "Alice"
    room.status = GameStatus.PLAYING
    room.question_index = 2
    room.question_start_time = datetime.now(UTC)
    room.config.multiple_choice_enabled = False

    state_builder.build_room_state(room)

    assert room.current_round.shuffled_options is None
```

### Tests for `test_game_service.py` (add to `TestGameService`)

```python
def test_advance_question_clears_shuffled_options(self, game_service, sample_questions):
    """Advancing to the next question resets shuffled_options."""
    room = Room("TEST1", sample_questions)
    room.players = {"player1"}
    room.scores = {"player1": 0}
    game_service.start_game(room)

    room.current_round.shuffled_options = ["A", "B", "C", "D"]

    game_service.advance_question(room)

    assert room.current_round.shuffled_options is None

def test_start_game_clears_shuffled_options(self, game_service, sample_questions):
    """Starting a game resets shuffled_options."""
    room = Room("TEST1", sample_questions)
    room.players = {"player1"}
    room.scores = {"player1": 0}

    room.current_round.shuffled_options = ["A", "B", "C", "D"]

    game_service.start_game(room)

    assert room.current_round.shuffled_options is None
```

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/app/models/round_state.py` | Add `shuffled_options: list[str] \| None = None` field, update docstring |
| `backend/src/app/services/orchestration/state_builder.py` | Use cached `shuffled_options` instead of re-shuffling |
| `backend/src/app/services/core/game_service.py` | Reset `shuffled_options = None` in `advance_question()` and `start_game()` |
| `backend/tests/unit/test_state_builder.py` | Add 4 tests: stability, caching, reset, MC-disabled |
| `backend/tests/unit/test_game_service.py` | Add 2 tests: advance clears options, start clears options |

## References

- Root cause: `backend/src/app/services/orchestration/state_builder.py:74-75`
- Round state model: `backend/src/app/models/round_state.py`
- Question advance logic: `backend/src/app/services/core/game_service.py:95-117`
- Existing MC test: `backend/tests/unit/test_state_builder.py:48-68`
- Wire format model: `backend/src/app/models/state.py:22-27` (CurrentQuestion)
- Frontend consumer: `frontend/src/features/game/Question/Question.tsx:61-75`

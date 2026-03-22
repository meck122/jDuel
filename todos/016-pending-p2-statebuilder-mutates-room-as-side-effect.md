---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, architecture, backend]
dependencies: []
---

# StateBuilder Mutates room.current_round.shuffled_options as a Side Effect

## Problem Statement

`StateBuilder._add_playing_state` conditionally writes `room.current_round.shuffled_options` while building a read-only state snapshot. A "builder" that projects state into a message should be a pure function — no writes. This makes `_broadcast_room_state` unexpectedly mutate game state, complicates testing, and makes it non-obvious when `shuffled_options` is actually set.

## Findings

- File: `backend/src/app/services/orchestration/state_builder.py` lines 74–78
- `shuffled_options` is computed and written during state broadcast, not during game setup
- Tests of `StateBuilder` must account for this mutation
- Any caller reasoning about when `shuffled_options` is populated will be surprised

## Proposed Solution

Move `shuffled_options` initialization to `GameService.advance_question()` (where the round starts):
```python
# In GameService.advance_question():
if room_config.multiple_choice_enabled and question.wrong_answers:
    options = [question.answer] + question.wrong_answers[:3]
    random.shuffle(options)
    round_state.shuffled_options = options
```
`StateBuilder._add_playing_state` then reads `room.current_round.shuffled_options` without writing.

## Acceptance Criteria
- [ ] `StateBuilder` never writes to `room` — it only reads
- [ ] `shuffled_options` is set when a new round starts, not during broadcast
- [ ] Existing multiple-choice tests pass

## Work Log
- 2026-03-22: Identified by `architecture-strategist` review agent

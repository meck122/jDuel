# TODO-016 [P2] StateBuilder Mutates shuffled_options During Read-Only Broadcast

## Status: Pending

## Problem

The `StateBuilder` (or equivalent state serialization logic) shuffles answer options in-place during what should be a read-only state broadcast. This means:
- Each broadcast produces a different option order (confusing if re-sent)
- The original question data is mutated as a side effect

## Affected Files

- `backend/src/app/services/orchestration/state_builder.py:56-85` — `_add_playing_state()` mutates `room.current_round.shuffled_options` at line 77 during broadcast

## Fix

Create a copy before shuffling:

```python
# Before
random.shuffle(question.options)  # mutates in place

# After
options = list(question.options)  # copy
random.shuffle(options)
```

Or shuffle once when the question is loaded and store the shuffled order.

## Impact

- **Severity:** Non-deterministic broadcasts, potential for option order inconsistency between players
- **Fix complexity:** Very low

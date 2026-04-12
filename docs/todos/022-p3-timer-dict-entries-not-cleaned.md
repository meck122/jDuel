# TODO-022 [P3] Timer Dict Entries Not Cleaned After Natural Expiry

## Status: Pending

## Problem

The `TimerService` stores `asyncio.Task` references in a dict keyed by room ID. When a timer completes naturally (not cancelled), its entry remains in the dict. If the room is then deleted, the orphaned entry is never cleaned up — minor memory leak.

## Affected Files

- `backend/src/app/services/core/timer_service.py:18-21` — dict declarations (`_question_timers`, `_result_timers`, `_game_over_timers`)
- `backend/src/app/services/core/timer_service.py:95-111` — `_run_timer()` completes callback but never removes dict entry
- `backend/src/app/services/core/timer_service.py:84-93` — `_cancel_timer()` does cleanup (line 93: `del timer_dict[room_id]`), but natural expiry path skips this

## Fix

Add a `done_callback` to remove the entry when the task completes:

```python
task = asyncio.create_task(self._timer_coro(room_id, ...))
task.add_done_callback(lambda t: self._tasks.pop(room_id, None))
self._tasks[room_id] = task
```

## Impact

- **Severity:** Minor memory leak, only matters with many room creations over time
- **Fix complexity:** Very low

---
status: pending
priority: p3
issue_id: "022"
tags: [code-review, backend, memory, performance]
dependencies: []
---

# Timer Dict Entries Not Removed After Natural Expiry — Slow Memory Leak

## Problem Statement

When a timer fires naturally (not cancelled), the completed `asyncio.Task` remains in `_question_timers`, `_result_timers`, or `_game_over_timers` until the next timer for the same `room_id` starts (which calls `_cancel_timer` and `del`). If a room is deleted mid-timer and the callback fires after deletion, the task completes and becomes orphaned in the dict forever — no subsequent timer for that `room_id` will ever come.

This is a slow leak: a finished `asyncio.Task` holds only a small coroutine frame, but it's unbounded over time.

## Findings

- File: `backend/src/app/services/core/timer_service.py` lines 95–110
- `cancel_all_timers_for_room` correctly handles mid-sleep cancellation
- The orphan path: room deleted → callback fires → `get_room` returns None → early return → task done but entry in dict persists

## Proposed Solution

Add a `done_callback` to remove the task from its owning dict:
```python
def _make_cleanup(self, timer_dict: dict, room_id: str):
    def cleanup(task):
        timer_dict.pop(room_id, None)
    return cleanup

# In start_question_timer:
task = asyncio.create_task(self._run_timer(...))
task.add_done_callback(self._make_cleanup(self._question_timers, room_id))
self._question_timers[room_id] = task
```

## Acceptance Criteria
- [ ] Timer dict entries are removed when task completes naturally
- [ ] No orphaned task entries accumulate over time
- [ ] Existing cancel logic still works

## Work Log
- 2026-03-22: Identified by `performance-oracle` review agent

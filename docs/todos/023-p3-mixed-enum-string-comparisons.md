# TODO-023 [P3] Mixed Enum/String Comparisons in Orchestrator

## Status: Pending

## Problem

At least 3 locations in the orchestrator compare `GameStatus` using `.value` string comparison instead of direct enum comparison. This is fragile and inconsistent with the rest of the codebase.

## Affected Files

- `backend/src/app/services/orchestration/orchestrator.py:232` — `if room.status.value != "waiting":` (should be `GameStatus.WAITING`)
- `backend/src/app/services/orchestration/orchestrator.py:377` — `if room and room.status.value == "playing":` (should be `GameStatus.PLAYING`)
- `backend/src/app/services/orchestration/orchestrator.py:383` — `if not room or room.status.value != "results":` (should be `GameStatus.RESULTS`)

Note: Lines 156 and 197 in the same file correctly use enum comparison — inconsistency.

## Fix

```python
# Before
if room.game_status.value == "playing":

# After
if room.game_status == GameStatus.PLAYING:
```

Find all instances with: `grep -n "\.value ==" game_orchestrator.py`

## Impact

- **Severity:** Code quality, potential for subtle bugs if enum values change
- **Fix complexity:** Very low — find and replace

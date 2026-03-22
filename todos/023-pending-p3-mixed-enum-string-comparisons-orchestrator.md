---
status: pending
priority: p3
issue_id: "023"
tags: [code-review, backend, quality]
dependencies: []
---

# Mixed Enum vs String Status Comparisons in Orchestrator

## Problem Statement

The orchestrator uses both `room.status.value != "waiting"` (string comparison) and `room.status != GameStatus.WAITING` (enum comparison) for the same type of check. Because `GameStatus` is a `str, Enum`, both work — but the inconsistency means a future rename or copy-paste silently diverges.

## Findings

- File: `backend/src/app/services/orchestration/orchestrator.py` lines 232, 377, 383
- Lines 232, 377, 383 use `.value` string comparisons
- Rest of file uses enum comparisons (lines 156, 197, etc.)

## Proposed Solution

Replace all `.value` string comparisons with enum member comparisons:
```python
# Before:
if room.status.value != "waiting":
# After:
if room.status != GameStatus.WAITING:
```

Three occurrences to fix.

## Acceptance Criteria
- [ ] All status comparisons in `orchestrator.py` use `GameStatus` enum members
- [ ] No `.value` string comparisons for `GameStatus`

## Work Log
- 2026-03-22: Identified by `kieran-python-reviewer` and `architecture-strategist` review agents

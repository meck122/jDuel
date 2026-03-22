---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, security, backend, privacy]
dependencies: []
---

# Correct Answers Logged at INFO Level — Privacy and Game Integrity Leak

## Problem Statement

Every answer attempt emits an INFO-level log containing both the user's answer and the correct answer verbatim. On production, `journalctl -u jduel-backend` (documented in deployment docs) would reveal all game answers to anyone with system log access. This creates a game integrity concern (the correct answers are logged) and a basic privacy concern for user-submitted text.

## Findings

- File: `backend/src/app/services/answer/answer_service.py` lines 137–143
```python
logger.info(
    "Answer check: user=%r, correct=%r, fuzzy=%.1f, embedding=%.2f",
    user_answer,
    correct_answer,
    ...
)
```
- The fuzzy and embedding scores are sufficient for debugging without including raw content

## Proposed Solution

Change `logger.info` to `logger.debug`:
```python
logger.debug(
    "Answer check: fuzzy=%.1f, embedding=%.2f, result=%s",
    fuzzy_score,
    embedding_score,
    result,
)
```
If the raw answers are needed for debugging, keep them at DEBUG but omit at INFO.

## Acceptance Criteria
- [ ] Correct answers not logged at INFO or WARNING level
- [ ] DEBUG level logging retains enough info for answer verification debugging
- [ ] No user answer text appears in `journalctl` output during normal gameplay

## Work Log
- 2026-03-22: Identified by `kieran-python-reviewer` and `security-sentinel` review agents

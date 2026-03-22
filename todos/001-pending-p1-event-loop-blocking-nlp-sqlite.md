---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, performance, backend, async]
dependencies: []
---

# Event Loop Blocking: NLP Inference and SQLite Queries Are Synchronous

## Problem Statement

The asyncio event loop is blocked by synchronous CPU-bound operations on every answer submission and game start. This stalls all WebSocket connections, timer callbacks, and broadcasts for the duration of each call.

**Why it matters:** On the 4 GB Oracle VPS with CPU-only NLP models (`all-MiniLM-L6-v2` via sentence-transformers), each `model.encode()` call takes 50–150 ms. Two players answering simultaneously means the second player's message is blocked behind the first player's NLP pipeline. Timers fire late during this window.

## Findings

**1. Double embedding encode in `answer_service.py`**
- File: `backend/src/app/services/answer/answer_service.py` lines 97–98
- `_embedding_similarity` calls `self.model.encode()` twice per answer — once for user answer and once for correct answer.
- The correct answer embedding is static for the entire round. It should be pre-computed once when the question is loaded.

**2. NLP inference blocks the event loop**
- File: `backend/src/app/services/answer/answer_service.py`
- `is_correct()` calls `self.model.encode()` (sentence-transformers) and `self.nlp()` (spaCy) synchronously.
- Called from `game_service.process_answer()` → `orchestrator.handle_answer()` (async def).

**3. SQLite query blocks event loop at game start**
- File: `backend/src/app/db/database.py` lines 42–64
- `get_random_questions_by_difficulty()` uses synchronous `sqlite3`, called from `handle_start_game` (async).
- `ORDER BY RANDOM()` is a full-table scan before sampling.

**4. spaCy lemmatization not cached**
- File: `backend/src/app/services/answer/answer_service.py` lines 131–132
- `_lemmatize` runs the full spaCy pipeline on the correct answer every time — should be cached alongside the embedding.

## Proposed Solutions

### Option A: run_in_executor + pre-compute embeddings (Recommended)
- Pre-compute the correct answer embedding and lemma in `GameService.advance_question()` and store on `RoundState`.
- Wrap the remaining single user-answer `encode()` call in `asyncio.get_event_loop().run_in_executor(None, ...)`.
- Wrap the SQLite call in `run_in_executor` or migrate to `aiosqlite`.
- **Pros:** Halves embedding work per answer; unblocks event loop; minimal structural change.
- **Cons:** Requires `RoundState` to carry the pre-computed embedding/lemma.
- **Effort:** Medium | **Risk:** Low

### Option B: Dedicated thread pool / background worker
- Run all NLP inference in a `ProcessPoolExecutor` to avoid GIL contention.
- **Pros:** Better parallelism for multi-room concurrent load.
- **Cons:** Process serialization overhead; significant refactor.
- **Effort:** Large | **Risk:** Medium

### Option C: Async SQLite only (partial fix)
- Migrate DB to `aiosqlite` without changing NLP.
- **Pros:** Fixes game-start stall easily.
- **Cons:** Leaves the larger NLP blocking problem unaddressed.
- **Effort:** Small | **Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details
- Affected files: `answer_service.py`, `database.py`, `game_service.py`, `round_state.py` (to add cached fields)
- No schema changes (in-memory only)
- Tests: `MockAnswerService` already bypasses real NLP — unit tests unaffected. Integration tests will need to verify async behavior.

## Acceptance Criteria
- [ ] No synchronous calls to `model.encode()`, `self.nlp()`, or `sqlite3` on the event loop thread
- [ ] Correct answer embedding pre-computed once per round, not per answer submission
- [ ] Game start does not stall WebSocket delivery measurably
- [ ] Existing answer verification tests pass

## Work Log
- 2026-03-22: Identified by `performance-oracle` and `kieran-python-reviewer` review agents

## Resources
- `backend/src/app/services/answer/answer_service.py`
- `backend/src/app/db/database.py`
- `backend/src/app/services/core/game_service.py`
- Python asyncio docs: `loop.run_in_executor`

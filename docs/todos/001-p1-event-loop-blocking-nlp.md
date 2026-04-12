# TODO-001 [P1] Event Loop Blocking — NLP model.encode() & SQLite

## Status: Pending

## Problem

`model.encode()` in `backend/src/app/services/answer/semantic_similarity.py` is a synchronous CPU-bound call (~50-200ms) that blocks the asyncio event loop. Every time a player submits an answer, **all** WebSocket connections freeze until encoding completes.

Similarly, any SQLite operations (if present) block the event loop.

## Affected Files

- `backend/src/app/services/answer/answer_service.py:95-99` — `_embedding_similarity()` calls `model.encode()` synchronously
- `backend/src/app/services/answer/answer_service.py:137-143` — `is_correct()` orchestrates verification
- `backend/src/app/services/orchestration/orchestrator.py:204` — calls `process_answer()` from async WS handler

## Fix

Wrap the blocking `model.encode()` call in `asyncio.to_thread()` (or use `loop.run_in_executor()`):

```python
# Before
embedding = self.model.encode(text)

# After
embedding = await asyncio.to_thread(self.model.encode, text)
```

This moves the CPU-bound work to a thread pool so the event loop stays responsive.

- Make `verify_answer` (and any sync callers up the chain) `async`
- Ensure all callers use `await`
- Consider a dedicated `ThreadPoolExecutor` with bounded workers to prevent thread explosion

## Impact

- **Severity:** Every answer submission freezes ALL rooms for 50-200ms
- **Fix complexity:** Medium — requires async refactor up the call chain
- **Risk:** Low — `to_thread` is well-tested in Python 3.13

## Testing

- Run `uv run pytest ../tests/` after changes
- Verify WS responsiveness under concurrent answer submissions

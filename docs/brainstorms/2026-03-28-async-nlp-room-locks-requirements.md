---
date: 2026-03-28
topic: async-nlp-room-locks
---

# Async NLP + Per-Room Locking

## Problem Frame

The NLP answer verification pipeline (`model.encode()`, `nlp()`, `fuzz.ratio()`) runs synchronously on the asyncio event loop, blocking **all** WebSocket connections for 50-200ms per answer submission. This is TODO-001.

Separately, room state mutations in the orchestrator have no concurrency control. Currently this is a latent bug because no `await` points exist mid-mutation. However, fixing 001 introduces an `await` inside `handle_answer` (for `asyncio.to_thread`), which means two concurrent answer submissions can now interleave and corrupt room state — double scoring, skipped questions, etc. This is TODO-002.

These two issues are **tightly coupled**: fixing 001 without 002 actively worsens the race condition risk. They must ship together.

## Requirements

- R1. `model.encode()` and `nlp()` calls must not block the asyncio event loop. Use `asyncio.to_thread()` to offload `AnswerService.is_correct()` to the default thread pool.
- R2. All state-mutating orchestrator methods must be protected by a per-room `asyncio.Lock` to prevent interleaved mutations. The lock lives on the `Room` model as `lock: asyncio.Lock = field(default_factory=asyncio.Lock)`.
- R3. The async refactor must propagate up the call chain: `GameService.process_answer()` becomes async, `GameOrchestrator.handle_answer()` awaits it.
- R4. `AnswerService.is_correct()` itself remains synchronous (it's the function passed to `to_thread`). No changes to the NLP pipeline internals.
- R5. Existing tests must continue to pass. The `MockAnswerService` used in tests is synchronous and lightweight — `to_thread` on it is harmless.

## Success Criteria

- WebSocket connections remain responsive during NLP processing (no event loop blocking)
- Concurrent answer submissions cannot corrupt room state (no double scoring, no skipped questions)
- All 91 existing tests pass
- No change to the WebSocket protocol or frontend

## Scope Boundaries

- NOT changing `AnswerService` internals or NLP pipeline
- NOT adding a dedicated `ThreadPoolExecutor` (default pool is sufficient given MAX_ROOMS=100 cap)
- NOT locking read-only operations (state broadcasts, get_room)
- NOT changing the frontend

## Key Decisions

- **Ship together**: 001 and 002 as a single change, because 001 creates the conditions that make 002 exploitable.
- **Lock on Room model**: `asyncio.Lock` as a field on the `Room` dataclass. Lifecycle matches room lifecycle — no manual cleanup needed.
- **asyncio.to_thread**: Simplest offloading mechanism. Default thread pool is sufficient given the low concurrency ceiling (max 100 rooms, ~20 players each).

## Deferred to Planning

- [Affects R2][Technical] Which orchestrator methods need the lock? `handle_answer` definitely; `handle_start_game`, `handle_play_again`, `handle_disconnect`, timer callbacks likely. `handle_reaction` and `handle_config_update` may be safe without it — needs analysis.
- [Affects R3][Technical] Does `process_answer` becoming async require changes to any test helpers or fixtures?

## Next Steps

-> `/ce:plan` for structured implementation planning

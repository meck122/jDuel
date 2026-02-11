# Brainstorm: Reconnection 429 Handling

**Date:** 2026-02-08
**Status:** Decided

## What We're Building

Quality of life improvement for reconnection: when a player hits a 429 (Too Many Requests) during page refresh or flaky network reconnection, the UI should show an auto-retry countdown instead of silently failing or showing a dead-end error.

Two changes:
1. **Raise join rate limit** from 10 to 20 requests per minute per IP — makes 429 harder to hit during normal reconnection flows
2. **Wire `useRetry` hook into GamePage** — when `registerAndConnect` gets a 429, show a countdown UI ("Retrying in Xs...") with automatic retry using exponential backoff and the server's `Retry-After` header

## Why This Approach

- The `useRetry` hook already exists with countdown timer, exponential backoff, jitter, and `Retry-After` override — it was built for exactly this use case but never connected
- Raising the limit is a one-line config change that reduces friction without removing protection
- No backend logic changes needed beyond the config tweak
- Rejected "exempt reconnections from rate limiting" — adds backend complexity and doesn't help fresh joins

## Key Decisions

- **Auto-retry with countdown** (not manual retry button) — player sees "Too many attempts. Retrying in 8s..." and it resolves automatically
- **Raise join limit to 20/min** — current 10/min is too easy to hit with page refreshes (each refresh = 1 join call)
- **Reuse existing `useRetry` hook** — no new retry infrastructure needed
- **429 treated as retryable in GamePage** — alongside existing NAME_TAKEN retry logic
- **Keep existing error UI for non-retryable errors** — ROOM_NOT_FOUND, GAME_STARTED still navigate away immediately

## Open Questions

None — scope is well-defined.

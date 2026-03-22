---
status: pending
priority: p1
issue_id: "007"
tags: [code-review, backend, memory, performance]
dependencies: []
---

# Rate Limiter Bucket Cleanup Never Scheduled — Unbounded Memory Growth

## Problem Statement

`cleanup_old_entries()` exists in `RateLimiter` but is never called. The `_buckets` `defaultdict` grows without bound as unique IPs hit the server. On a long-running deployment this is a slow but unbounded memory leak.

## Findings

- File: `backend/src/app/middleware/rate_limiter.py` lines 114–132
- `cleanup_old_entries` iterates buckets and removes entries older than `window_seconds`
- It is defined but never invoked — no periodic task, no lifespan hook, nothing
- Each unique client IP creates an entry; with the IP spoofing issue (#005), an attacker can create entries for millions of fake IPs

## Proposed Solutions

### Option A: Schedule as background asyncio task in lifespan (Recommended)
```python
# In main.py lifespan, after rate limiter init:
async def cleanup_loop():
    while True:
        await asyncio.sleep(1800)  # every 30 minutes
        rate_limiter.cleanup_old_entries()
asyncio.create_task(cleanup_loop())
```
- **Pros:** Simple, uses existing method, no new dependencies.
- **Effort:** Small | **Risk:** Low

### Option B: Lazy cleanup on every rate limit check
- Call `cleanup_old_entries()` at the start of `is_allowed()` with a time-gated check (only if > 10 min since last cleanup)
- **Pros:** No background task needed.
- **Cons:** Adds latency to every rate check.
- **Effort:** Small | **Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details
- Affected files: `backend/src/app/middleware/rate_limiter.py`, `backend/src/app/main.py`

## Acceptance Criteria
- [ ] `cleanup_old_entries()` is called periodically (at least every 30 minutes)
- [ ] Memory usage of rate limiter stays bounded on long-running server
- [ ] Cleanup is cancelled cleanly on server shutdown

## Work Log
- 2026-03-22: Identified by `kieran-python-reviewer` review agent

## Resources
- `backend/src/app/middleware/rate_limiter.py`
- `backend/src/app/main.py`

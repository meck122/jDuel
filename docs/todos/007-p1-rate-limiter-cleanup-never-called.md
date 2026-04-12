# TODO-007 [P1] Rate Limiter Cleanup Never Scheduled

## Status: Pending

## Problem

The rate limiter stores per-IP request timestamps in a dict, but the cleanup function that prunes expired entries is never called on a schedule. Over time, this dict grows without bound — slow memory leak that eventually exhausts the 4GB VPS.

## Affected Files

- `backend/src/app/middleware/rate_limiter.py:114-132` — `cleanup_old_entries()` method exists but is never called anywhere
- `backend/src/app/main.py:16-26` — lifespan function (should schedule periodic cleanup here)

## Fix

Schedule periodic cleanup in the FastAPI lifespan:

```python
async def lifespan(app: FastAPI):
    # ... existing startup
    cleanup_task = asyncio.create_task(periodic_cleanup())
    yield
    cleanup_task.cancel()

async def periodic_cleanup():
    while True:
        await asyncio.sleep(300)  # every 5 minutes
        rate_limiter.cleanup_old_entries()
```

Or alternatively, clean up lazily on each rate-limit check (prune entries older than the window).

## Impact

- **Severity:** Unbounded memory growth, eventual OOM
- **Fix complexity:** Low — add one background task
- **Risk:** None

## Testing

- Unit test that cleanup removes expired entries
- Verify memory doesn't grow under sustained load

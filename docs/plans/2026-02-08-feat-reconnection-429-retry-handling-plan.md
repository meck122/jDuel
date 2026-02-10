---
title: "feat: Add 429 retry handling for GamePage reconnection"
type: feat
date: 2026-02-08
---

# feat: Add 429 retry handling for GamePage reconnection

## Overview

When players hit a 429 (Too Many Requests) during page refresh or flaky reconnection, the UI currently hangs on "Connecting to room..." forever with no feedback. This plan wires the existing `useRetry` hook into GamePage's reconnection flow to show an auto-retry countdown, and raises the join rate limit to reduce how often 429s occur.

## Problem Statement

1. **Silent failure:** A 429 during `registerAndConnect` falls through all error checks unhandled — the player sees "Connecting to room AB3D..." spinner forever
2. **Too-easy to hit:** The join rate limit of 10/min/IP means ~10 page refreshes in a minute triggers it — common during development and flaky mobile connections
3. **No error code:** The backend 429 response lacks a `code` field, so the frontend maps it to `NETWORK_ERROR` — losing the ability to distinguish rate limiting from actual network failures
4. **`retryAfter` never populated:** `ApiError` has a `retryAfter` field but `api.ts` never reads the `Retry-After` header

## Proposed Solution

**Backend (1 file):**
- Raise `RATE_LIMIT_ROOM_JOIN` from `(10, 60)` to `(20, 60)` in `config/game.py`
- Add `"code": "RATE_LIMITED"` to the 429 response detail in `dependencies.py`

**Frontend (4 files):**
- Parse `Retry-After` header in `api.ts` for both `joinRoom()` and `createRoom()`
- Add `RATE_LIMITED` to `ApiErrorCode` type
- Wire `useRetry` into `GamePage.tsx` for 429 errors only (keep NAME_TAKEN manual retry as-is)
- Add countdown UI state ("Too many attempts. Retrying in Xs...")

## Technical Approach

### Design Decisions (from brainstorm + SpecFlow)

| Decision | Choice | Rationale |
|---|---|---|
| Retry mechanism for 429 | `useRetry` hook (existing) | Already built with countdown, backoff, jitter, Retry-After support |
| NAME_TAKEN retry | Keep manual 500ms retry | Needs fast fixed-interval retry (~1s race condition), not exponential backoff |
| Error classification | Handle inside operation callback | Non-retryable errors (ROOM_NOT_FOUND, GAME_STARTED) handled inside callback, only 429 re-thrown to `useRetry` |
| Max retries exhausted | Show error container with nav buttons | Reuse existing `.errorContainer` styles |
| Countdown UX | Replace "Connecting..." with countdown card | Show "Too many attempts. Retrying in Xs..." with "Back to Home" escape button |
| `Retry-After` source | HTTP header first, body fallback | Standard HTTP convention, CDN/proxy compatible |
| Backoff vs server delay | Use `max(serverRetryAfter, exponentialBackoff)` | Prevents thundering herd when server returns fixed value |
| HomePage 429 | Out of scope | User-initiated action, not automatic retry scenario |

### Implementation Details

#### 1. Backend: Add `RATE_LIMITED` code to 429 responses

**File:** `backend/src/app/api/dependencies.py`

Update both `rate_limit_room_create` and `rate_limit_room_join` to include `"code": "RATE_LIMITED"` in the detail dict:

```python
# Before
detail={"error": "Too many join attempts", "retry_after": e.retry_after}

# After
detail={"code": "RATE_LIMITED", "error": "Too many join attempts", "retry_after": e.retry_after}
```

#### 2. Backend: Raise join rate limit

**File:** `backend/src/app/config/game.py`

```python
# Before
RATE_LIMIT_ROOM_JOIN = (10, 60)

# After
RATE_LIMIT_ROOM_JOIN = (20, 60)  # 20 joins per minute per IP
```

#### 3. Frontend: Parse Retry-After in api.ts

**File:** `frontend/src/services/api.ts`

Add `RATE_LIMITED` to `ApiErrorCode`:
```typescript
export type ApiErrorCode =
  | "ROOM_NOT_FOUND"
  | "NAME_TAKEN"
  | "GAME_STARTED"
  | "VALIDATION_ERROR"
  | "INVALID_SESSION"
  | "RATE_LIMITED"
  | "NETWORK_ERROR";
```

In both `joinRoom()` and `createRoom()`, parse the `Retry-After` header when status is 429:
```typescript
if (!response.ok) {
  const error = await response.json();
  const retryAfter = response.status === 429
    ? parseInt(response.headers.get("Retry-After") || "") || error.detail?.retry_after
    : undefined;
  throw new ApiError(
    error.detail?.code || "NETWORK_ERROR",
    error.detail?.error || "Failed to join room",
    response.status,
    retryAfter
  );
}
```

#### 4. Frontend: Wire useRetry into GamePage

**File:** `frontend/src/pages/GamePage/GamePage.tsx`

**Key architecture:** `useRetry` wraps an operation that internally handles NAME_TAKEN (fast 500ms retry) and navigation errors (ROOM_NOT_FOUND, GAME_STARTED). Only 429/RATE_LIMITED errors are re-thrown to `useRetry` for exponential backoff.

```typescript
// Pseudocode for the refactored flow:

function GamePageContent() {
  // ... existing state ...

  // Operation that useRetry will manage
  const reconnectOperation = useCallback(async () => {
    try {
      // Inner loop: handle NAME_TAKEN with fast retry (existing logic)
      await joinWithNameTakenRetry(roomId, playerId, 4);
      connect(roomId, playerId);
      setHasInitialized(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "ROOM_NOT_FOUND") {
          navigate(`/?join=${roomId}`, { replace: true });
          return; // Don't re-throw — useRetry should not retry this
        }
        if (error.code === "GAME_STARTED" || error.code === "NAME_TAKEN") {
          navigate("/", { replace: true });
          return; // Terminal — navigate away
        }
        if (error.code === "RATE_LIMITED") {
          throw error; // Re-throw for useRetry to handle
        }
      }
      // Unknown errors — navigate away
      navigate(`/?join=${roomId}&error=unexpected`, { replace: true });
    }
  }, [roomId, playerId, navigate, connect]);

  const { isRetrying, currentAttempt, nextRetryIn, error: retryError, cancel } =
    useRetry(reconnectOperation, RETRY_OPTIONS);

  // Trigger initial connection
  useEffect(() => {
    if (!hasInitialized && roomId && playerId && !isRetrying) {
      reconnectOperation().catch(() => {}); // Errors handled inside
    }
  }, [/* deps */]);

  // Render states:
  // 1. Retrying with countdown → show countdown card
  // 2. Retry exhausted → show error container
  // 3. Connection error (WebSocket) → existing error UI
  // 4. Connecting → "Connecting to room..."
  // 5. Connected → GameView
}
```

**Note on useRetry integration:** The `reconnectOperation` callback is defined at the component level with `useCallback`, not inside `useEffect`. The `ignore` pattern for Strict Mode is handled by checking `hasInitialized` in the `useEffect` guard. `useRetry`'s internal cleanup handles timer cancellation on unmount.

**Retry options:** Define as module-level constant to avoid re-render instability:
```typescript
const RETRY_OPTIONS = { maxRetries: 4, initialDelay: 2000, maxDelay: 8000 };
```

#### 5. Frontend: Add countdown UI to GamePage

**File:** `frontend/src/pages/GamePage/GamePage.tsx`

New render state between "connecting" and "error":

```tsx
// Retrying state — auto-retry with countdown
if (isRetrying && nextRetryIn !== null) {
  return (
    <PageContainer centered maxWidth="sm">
      <div className={styles.retryContainer}>
        <h2 className={styles.retryTitle}>Too many attempts</h2>
        <p className={styles.retryMessage}>
          Retrying in {nextRetryIn}s... (attempt {currentAttempt}/4)
        </p>
        <button
          onClick={() => { cancel(); navigate("/", { replace: true }); }}
          className={styles.secondaryButton}
        >
          Back to Home
        </button>
      </div>
    </PageContainer>
  );
}

// Max retries exhausted
if (retryError && !isRetrying) {
  return (
    <PageContainer centered maxWidth="sm">
      <div className={styles.errorContainer}>
        <h2 className={styles.errorTitle}>Unable to Reconnect</h2>
        <p className={styles.errorMessage}>
          Could not reconnect after multiple attempts. The room may no longer be available.
        </p>
        <div className={styles.errorActions}>
          <button onClick={() => navigate(`/?join=${roomId}`, { replace: true })}
            className={styles.secondaryButton}>Try Rejoining</button>
          <button onClick={() => navigate("/", { replace: true })}
            className={styles.primaryButton}>Back to Home</button>
        </div>
      </div>
    </PageContainer>
  );
}
```

#### 6. Frontend: Add retry countdown styles

**File:** `frontend/src/pages/GamePage/GamePage.module.css`

Add `.retryContainer`, `.retryTitle`, `.retryMessage` — similar to `.errorContainer` but using `--color-accent-yellow` or `--color-text-dim` instead of `--color-accent-red` to distinguish "waiting" from "failed".

#### 7. Fix useRetry to use max(serverRetryAfter, backoff)

**File:** `frontend/src/hooks/useRetry.ts`

Change the delay calculation (line 140-153) so that `retryAfter` is a floor, not a complete override:

```typescript
// Before: override
if (error instanceof ApiError && error.retryAfter) {
  delay = error.retryAfter * 1000;
} else {
  delay = calculateDelay(...);
}

// After: use whichever is larger
const backoffDelay = calculateDelay(attemptNumber, opts.initialDelay, opts.maxDelay, opts.exponential, opts.jitter);
if (error instanceof ApiError && error.retryAfter) {
  delay = Math.max(error.retryAfter * 1000, backoffDelay);
} else {
  delay = backoffDelay;
}
```

#### 8. Export useRetry from hooks barrel

**File:** `frontend/src/hooks/index.ts`

Add `export { useRetry } from "./useRetry";`

## Acceptance Criteria

- [x] 429 during GamePage reconnection shows "Too many attempts. Retrying in Xs..." countdown
- [x] Countdown auto-retries and succeeds when rate limit clears
- [x] "Back to Home" button visible during countdown
- [x] After max retries (4), shows error container with "Try Rejoining" / "Back to Home"
- [x] If retry gets ROOM_NOT_FOUND, navigates away immediately (no further retries)
- [x] NAME_TAKEN retry still works with fast 500ms intervals (unchanged behavior)
- [x] Join rate limit is 20/min/IP (up from 10)
- [x] Backend 429 response includes `"code": "RATE_LIMITED"`
- [x] `ApiError.retryAfter` populated from `Retry-After` header on 429 responses

## Files Changed

| File | Change |
|---|---|
| `backend/src/app/config/game.py:20` | Raise join limit 10→20 |
| `backend/src/app/api/dependencies.py:56-61,68-73` | Add `code: RATE_LIMITED` to 429 detail |
| `frontend/src/services/api.ts:25-31` | Add `RATE_LIMITED` to ApiErrorCode |
| `frontend/src/services/api.ts:115-150` | Parse Retry-After header in joinRoom |
| `frontend/src/services/api.ts:84-105` | Parse Retry-After header in createRoom |
| `frontend/src/hooks/useRetry.ts:140-153` | Use max(serverRetryAfter, backoff) |
| `frontend/src/hooks/index.ts` | Export useRetry |
| `frontend/src/pages/GamePage/GamePage.tsx` | Wire useRetry, add countdown/exhausted states |
| `frontend/src/pages/GamePage/GamePage.module.css` | Add .retryContainer styles |

## Out of Scope

- HomePage 429 handling (user-initiated, not auto-retry)
- WebSocket rate limit UI (messages are silently dropped, no user impact)
- EventProtocol.md update (can be a follow-up)
- Exempting reconnections from rate limiting (rejected in brainstorm)

## References

- Brainstorm: `docs/brainstorms/2026-02-08-reconnection-429-handling-brainstorm.md`
- useRetry hook: `frontend/src/hooks/useRetry.ts`
- Rate limiter: `backend/src/app/middleware/rate_limiter.py`
- GamePage reconnection: `frontend/src/pages/GamePage/GamePage.tsx:56-88`
- API error handling: `frontend/src/services/api.ts:68-150`
- Rate limit config: `backend/src/app/config/game.py:18-21`
- Rate limit dependencies: `backend/src/app/api/dependencies.py:46-79`

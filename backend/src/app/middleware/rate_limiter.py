"""In-memory rate limiter for API endpoints and WebSocket connections."""

import time
from collections import defaultdict
from dataclasses import dataclass
from threading import Lock


class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded."""

    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded. Retry after {retry_after} seconds.")


@dataclass
class RateLimitState:
    """Tracks rate limit state for a single key."""

    tokens: float
    last_update: float


class RateLimiter:
    """Thread-safe in-memory rate limiter using token bucket algorithm.

    This provides rate limiting for:
    - HTTP endpoints (by IP address)
    - WebSocket connections (by connection ID)

    Uses a token bucket algorithm where tokens are replenished over time.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        """Initialize rate limiter.

        Args:
            max_requests: Maximum requests allowed in the window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.refill_rate = max_requests / window_seconds
        self._buckets: dict[str, RateLimitState] = defaultdict(
            lambda: RateLimitState(tokens=max_requests, last_update=time.time())
        )
        self._lock = Lock()
        self._cleanup_threshold = 10000  # Clean up after this many entries

    def _refill_tokens(self, state: RateLimitState) -> None:
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - state.last_update
        state.tokens = min(self.max_requests, state.tokens + elapsed * self.refill_rate)
        state.last_update = now

    def check(self, key: str) -> bool:
        """Check if request is allowed and consume a token.

        Args:
            key: Identifier for rate limiting (e.g., IP address, connection ID)

        Returns:
            True if request is allowed, False if rate limited
        """
        with self._lock:
            state = self._buckets[key]
            self._refill_tokens(state)

            if state.tokens >= 1:
                state.tokens -= 1
                return True
            return False

    def check_or_raise(self, key: str) -> None:
        """Check rate limit and raise exception if exceeded.

        Args:
            key: Identifier for rate limiting

        Raises:
            RateLimitExceeded: If rate limit is exceeded
        """
        if not self.check(key):
            # Calculate retry-after based on token refill time
            retry_after = int(1 / self.refill_rate) + 1
            raise RateLimitExceeded(retry_after)

    def get_remaining(self, key: str) -> int:
        """Get remaining requests for a key.

        Args:
            key: Identifier for rate limiting

        Returns:
            Number of remaining requests
        """
        with self._lock:
            state = self._buckets[key]
            self._refill_tokens(state)
            return int(state.tokens)

    def reset(self, key: str) -> None:
        """Reset rate limit for a key.

        Args:
            key: Identifier to reset
        """
        with self._lock:
            if key in self._buckets:
                del self._buckets[key]

    def cleanup_old_entries(self, max_age_seconds: int = 3600) -> int:
        """Remove stale entries to prevent memory growth.

        Args:
            max_age_seconds: Remove entries older than this

        Returns:
            Number of entries removed
        """
        with self._lock:
            now = time.time()
            stale_keys = [
                key
                for key, state in self._buckets.items()
                if now - state.last_update > max_age_seconds
            ]
            for key in stale_keys:
                del self._buckets[key]
            return len(stale_keys)


# Global rate limiter instances
_room_create_limiter: RateLimiter | None = None
_room_join_limiter: RateLimiter | None = None
_ws_message_limiter: RateLimiter | None = None


def get_room_create_limiter() -> RateLimiter:
    """Get or create room creation rate limiter."""
    global _room_create_limiter
    if _room_create_limiter is None:
        from app.config import RATE_LIMIT_ROOM_CREATE

        max_requests, window = RATE_LIMIT_ROOM_CREATE
        _room_create_limiter = RateLimiter(max_requests, window)
    return _room_create_limiter


def get_room_join_limiter() -> RateLimiter:
    """Get or create room join rate limiter."""
    global _room_join_limiter
    if _room_join_limiter is None:
        from app.config import RATE_LIMIT_ROOM_JOIN

        max_requests, window = RATE_LIMIT_ROOM_JOIN
        _room_join_limiter = RateLimiter(max_requests, window)
    return _room_join_limiter


def get_ws_message_limiter() -> RateLimiter:
    """Get or create WebSocket message rate limiter."""
    global _ws_message_limiter
    if _ws_message_limiter is None:
        from app.config import RATE_LIMIT_WS_MESSAGES

        max_requests, window = RATE_LIMIT_WS_MESSAGES
        _ws_message_limiter = RateLimiter(max_requests, window)
    return _ws_message_limiter

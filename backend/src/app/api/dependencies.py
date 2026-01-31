"""FastAPI dependency injection for services.

This module provides FastAPI Depends() wrappers for service injection,
enabling proper lifecycle management and easier testing.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.middleware.rate_limiter import (
    RateLimitExceeded,
    get_room_create_limiter,
    get_room_join_limiter,
)
from app.services.container import ServiceContainer, get_container


def get_services() -> ServiceContainer:
    """Get the service container for dependency injection.

    Returns:
        The initialized ServiceContainer
    """
    return get_container()


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies.

    Args:
        request: The FastAPI request object

    Returns:
        Client IP address
    """
    # Check X-Forwarded-For header (set by nginx/proxy)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP (original client)
        return forwarded.split(",")[0].strip()
    # Fall back to direct connection IP
    return request.client.host if request.client else "unknown"


def rate_limit_room_create(request: Request) -> None:
    """Rate limit dependency for room creation.

    Raises:
        HTTPException: 429 if rate limit exceeded
    """
    client_ip = get_client_ip(request)
    limiter = get_room_create_limiter()
    try:
        limiter.check_or_raise(client_ip)
    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=429,
            detail={"error": "Too many rooms created", "retry_after": e.retry_after},
            headers={"Retry-After": str(e.retry_after)},
        ) from e


def rate_limit_room_join(request: Request) -> None:
    """Rate limit dependency for room joining.

    Raises:
        HTTPException: 429 if rate limit exceeded
    """
    client_ip = get_client_ip(request)
    limiter = get_room_join_limiter()
    try:
        limiter.check_or_raise(client_ip)
    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=429,
            detail={"error": "Too many join attempts", "retry_after": e.retry_after},
            headers={"Retry-After": str(e.retry_after)},
        ) from e


# Type alias for injecting the full service container
Services = Annotated[ServiceContainer, Depends(get_services)]

# Rate limit dependencies
RateLimitRoomCreate = Annotated[None, Depends(rate_limit_room_create)]
RateLimitRoomJoin = Annotated[None, Depends(rate_limit_room_join)]

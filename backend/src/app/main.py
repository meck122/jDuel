"""Main FastAPI application for the trivia game."""

import asyncio
import contextlib
import logging

from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router, handle_websocket
from app.config import CORS_ORIGINS, ROOM_ID_PATTERN, setup_logging

setup_logging()
logger = logging.getLogger(__name__)


async def _periodic_rate_limit_cleanup(interval_seconds: int = 300) -> None:
    """Periodically prune stale rate limiter entries to prevent memory growth."""
    from app.middleware.rate_limiter import (
        get_room_create_limiter,
        get_room_join_limiter,
        get_ws_message_limiter,
    )

    while True:
        await asyncio.sleep(interval_seconds)
        for limiter in (
            get_room_create_limiter(),
            get_room_join_limiter(),
            get_ws_message_limiter(),
        ):
            removed = limiter.cleanup_old_entries()
            if removed:
                logger.debug(f"Rate limiter cleanup: removed {removed} stale entries")


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    """Manage application lifespan events."""
    from app.services import init_services, load_answer_service

    answer_service = load_answer_service()
    init_services(answer_service)

    cleanup_task = asyncio.create_task(_periodic_rate_limit_cleanup())

    yield

    cleanup_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await cleanup_task
    logger.info("Application shutdown")


def create_app(lifespan_override=None) -> FastAPI:
    """App factory. Accepts optional lifespan override for testing."""
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

    _app = FastAPI(
        title="jDuel API",
        version="1.0.0",
        lifespan=lifespan_override or lifespan,
    )
    _app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["127.0.0.1"])
    _app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    _app.include_router(api_router)

    @_app.get("/health")
    def health():
        """Health check endpoint."""
        return {"status": "ok"}

    @_app.websocket("/ws")
    async def ws_endpoint(
        websocket: WebSocket,
        roomId: str = Query(
            ...,
            pattern=ROOM_ID_PATTERN,
            description="Room ID to connect to (4-6 alphanumeric characters)",
        ),
        playerId: str = Query(
            ...,
            min_length=1,
            max_length=20,
            description="Player ID (must be pre-registered)",
        ),
    ):
        """WebSocket endpoint for real-time game communication."""
        await handle_websocket(websocket, roomId.upper(), playerId)

    return _app


app = create_app()

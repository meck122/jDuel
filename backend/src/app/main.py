"""Main FastAPI application for the trivia game."""

import contextlib
import logging

from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router, handle_websocket
from app.config import CORS_ORIGINS, ROOM_ID_PATTERN, setup_logging

setup_logging()
logger = logging.getLogger(__name__)


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    """Manage application lifespan events."""
    from app.services import init_services, load_answer_service

    answer_service = load_answer_service()
    init_services(answer_service)

    yield

    logger.info("Application shutdown")


def create_app(lifespan_override=None) -> FastAPI:
    """App factory. Accepts optional lifespan override for testing."""
    _app = FastAPI(
        title="jDuel API",
        version="1.0.0",
        lifespan=lifespan_override or lifespan,
    )
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

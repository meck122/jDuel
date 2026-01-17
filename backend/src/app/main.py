"""Main FastAPI application for the trivia game."""

import contextlib
import logging

from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router, handle_websocket
from app.config import CORS_ORIGINS, setup_logging

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


app = FastAPI(title="jDuel API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register HTTP API routes
app.include_router(api_router)


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.websocket("/ws")
async def ws_endpoint(
    websocket: WebSocket,
    roomId: str = Query(..., description="Room ID to connect to"),
    playerId: str = Query(..., description="Player ID (must be pre-registered)"),
):
    """WebSocket endpoint for real-time game communication.

    Players must first register via POST /api/rooms/{roomId}/join before
    connecting via WebSocket with their roomId and playerId as query params.

    Example: ws://localhost:8000/ws?roomId=ABC123&playerId=Alice
    """
    await handle_websocket(websocket, roomId.upper(), playerId)

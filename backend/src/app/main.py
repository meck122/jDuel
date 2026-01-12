"""Main FastAPI application for the trivia game."""

import contextlib
import logging
from pathlib import Path

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import handle_websocket
from app.config import CORS_ORIGINS, setup_logging

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    """Manage application lifespan events."""
    from app.services.answer_service import AnswerService
    from app.services.container import init_services

    # Initialize all services at startup
    logger.info("Initializing AnswerService...")
    answer_service = AnswerService()
    logger.info("AnswerService ready!")

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


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time game communication."""
    await handle_websocket(websocket)


# Serve static files (only mount if dist directory exists - for production)
BUILD_DIR = Path(__file__).parent.parent.parent.parent / "frontend" / "dist"
if BUILD_DIR.exists():
    app.mount("/", StaticFiles(directory=BUILD_DIR, html=True), name="static")

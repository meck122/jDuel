"""Main FastAPI application for the trivia game."""

from pathlib import Path

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.game_orchestrator import orchestrate_game_session
from app.config import CORS_ORIGINS, setup_logging

# Initialize logging
setup_logging()

app = FastAPI(title="jDuel API", version="1.0.0")

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
    await orchestrate_game_session(websocket)


# Serve static files (only mount if dist directory exists - for production)
BUILD_DIR = Path(__file__).parent.parent.parent.parent / "frontend" / "dist"
if BUILD_DIR.exists():
    app.mount("/", StaticFiles(directory=BUILD_DIR, html=True), name="static")

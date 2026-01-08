"""Main FastAPI application for the trivia game."""

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.services.room_manager import RoomManager
from app.api.websocket import websocket_endpoint
from app.config import CORS_ORIGINS
from fastapi.staticfiles import StaticFiles 
from pathlib import Path

app = FastAPI(title="jDuel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize room manager
room_manager = RoomManager()

@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time game communication."""
    await websocket_endpoint(websocket, room_manager)


# Serve static files (only mount if dist directory exists - for production)
BUILD_DIR = Path(__file__).parent.parent.parent.parent / "frontend" / "dist"
if BUILD_DIR.exists():
    app.mount("/", StaticFiles(directory=BUILD_DIR, html=True), name="static")



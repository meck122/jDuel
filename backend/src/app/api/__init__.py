"""API layer for handling HTTP and WebSocket endpoints."""

from app.api.routes import router as api_router
from app.api.websocket_handler import handle_websocket

__all__ = ["api_router", "handle_websocket"]

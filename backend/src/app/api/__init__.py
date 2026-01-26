"""API layer for handling HTTP and WebSocket endpoints."""

from app.api.dependencies import Services, get_services
from app.api.routes import router as api_router
from app.api.websocket_handler import handle_websocket

__all__ = ["Services", "api_router", "get_services", "handle_websocket"]

"""API layer for handling HTTP and WebSocket endpoints."""

from app.api.websocket_handler import handle_websocket

__all__ = ["handle_websocket"]

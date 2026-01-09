"""WebSocket handler for game communication."""

import contextlib
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.services.game_service import GameService
from app.services.orchestrator import GameOrchestrator, RoomCloser
from app.services.room_manager import RoomManager
from app.services.state_builder import StateBuilder
from app.services.timer_service import TimerService

logger = logging.getLogger(__name__)


class WebSocketRoomCloser(RoomCloser):
    """Handles room closing with WebSocket notifications."""

    def __init__(self, room_manager: RoomManager, timer_service: TimerService):
        self._room_manager = room_manager
        self._timer_service = timer_service

    async def close_room(self, room_id: str) -> None:
        """Close room and notify all connected clients."""
        room = self._room_manager.get_room(room_id)
        if room:
            # Notify all players that room is closing
            for _player_id, ws in list(room.players.items()):
                with contextlib.suppress(Exception):
                    await ws.send_json({"type": "ROOM_CLOSED"})

            logger.info(f"Auto-closing room after game over timeout: room_id={room_id}")
            self._timer_service.cancel_all_room_timers(room_id)
            self._room_manager.delete_room(room_id)


# Service instances
# Note: For production, consider using FastAPI's dependency injection
room_manager = RoomManager()
game_service = GameService()
timer_service = TimerService()
state_builder = StateBuilder()
room_closer = WebSocketRoomCloser(room_manager, timer_service)
orchestrator = GameOrchestrator(
    room_manager, game_service, timer_service, state_builder, room_closer
)


async def handle_websocket(ws: WebSocket) -> None:
    """Handle WebSocket connection for game communication.

    This is the main entry point for WebSocket connections. It handles
    the WebSocket protocol and delegates game logic to the orchestrator.

    Args:
        ws: The WebSocket connection
    """
    await ws.accept()

    current_room_id: str | None = None
    current_player_id: str | None = None

    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")

            if msg_type == "JOIN_ROOM":
                current_room_id = message["roomId"]
                current_player_id = message["playerId"]
                await orchestrator.handle_join(current_room_id, current_player_id, ws)

            elif msg_type == "START_GAME":
                if current_room_id:
                    await orchestrator.handle_start_game(current_room_id)

            elif msg_type == "ANSWER":
                if current_room_id and current_player_id:
                    await orchestrator.handle_answer(
                        current_room_id, current_player_id, message["answer"]
                    )

    except WebSocketDisconnect:
        if current_room_id and current_player_id:
            await orchestrator.handle_disconnect(current_room_id, current_player_id)

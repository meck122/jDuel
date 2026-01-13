"""WebSocket handler for game communication."""

import contextlib
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.services.orchestrator import RoomCloser
from app.services.room_manager import RoomManager
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
            for _player_id, ws in list(room.connections.items()):
                with contextlib.suppress(Exception):
                    await ws.send_json({"type": "ROOM_CLOSED"})

            logger.info(f"Auto-closing room after game over timeout: room_id={room_id}")
            self._timer_service.cancel_all_timers_for_room(room_id)
            self._room_manager.delete_room(room_id)


async def handle_websocket(ws: WebSocket, room_id: str, player_id: str) -> None:
    """Handle WebSocket connection for game communication.

    Players must pre-register via HTTP POST /api/rooms/{roomId}/join before
    connecting via WebSocket. The WebSocket connection binds to the registered
    player slot.

    Args:
        ws: The WebSocket connection
        room_id: The room ID to connect to (from query param)
        player_id: The player ID (from query param, must be pre-registered)
    """
    from app.services.container import get_container

    container = get_container()
    orchestrator = container.orchestrator
    room_manager = container.room_manager

    # Validate room and player before accepting connection
    room = room_manager.get_room(room_id)
    if not room:
        await ws.close(code=4004, reason="Room not found")
        return

    if player_id not in room.players:
        await ws.close(code=4003, reason="Player not registered")
        return

    # Check if player is already connected (prevent hijacking)
    if player_id in room.connections:
        await ws.close(code=4009, reason="Player already connected")
        return

    # Accept the WebSocket connection
    await ws.accept()

    # Attach the WebSocket to the registered player
    success = await orchestrator.handle_connect(room_id, player_id, ws)
    if not success:
        await ws.close(code=4000, reason="Failed to connect")
        return

    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")

            if msg_type == "START_GAME":
                await orchestrator.handle_start_game(room_id)

            elif msg_type == "ANSWER":
                await orchestrator.handle_answer(room_id, player_id, message["answer"])

    except WebSocketDisconnect:
        await orchestrator.handle_disconnect(room_id, player_id)
    except Exception as e:
        logger.error(
            f"WebSocket error: room_id={room_id}, player_id={player_id}, error={e!s}",
            exc_info=True,
        )
        await orchestrator.handle_disconnect(room_id, player_id)

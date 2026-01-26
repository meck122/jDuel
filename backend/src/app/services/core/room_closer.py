"""Room closer service for handling room cleanup with notifications."""

import contextlib
import logging
from typing import TYPE_CHECKING

from app.services.orchestration.protocols import RoomCloser

if TYPE_CHECKING:
    from app.services.core.room_manager import RoomManager
    from app.services.core.timer_service import TimerService

logger = logging.getLogger(__name__)


class WebSocketRoomCloser(RoomCloser):
    """Handles room closing with WebSocket notifications.

    This service is responsible for:
    - Notifying all connected clients when a room is being closed
    - Canceling active timers for the room
    - Deleting the room from the room manager
    """

    def __init__(self, room_manager: "RoomManager", timer_service: "TimerService"):
        """Initialize the room closer.

        Args:
            room_manager: Service for managing rooms
            timer_service: Service for managing timers
        """
        self._room_manager = room_manager
        self._timer_service = timer_service

    async def close_room(self, room_id: str) -> None:
        """Close room and notify all connected clients.

        Args:
            room_id: The ID of the room to close
        """
        room = self._room_manager.get_room(room_id)
        if room:
            # Notify all players that room is closing
            for _player_id, ws in list(room.connections.items()):
                with contextlib.suppress(Exception):
                    await ws.send_json({"type": "ROOM_CLOSED"})

            logger.info(f"Auto-closing room after game over timeout: room_id={room_id}")
            self._timer_service.cancel_all_timers_for_room(room_id)
            self._room_manager.delete_room(room_id)

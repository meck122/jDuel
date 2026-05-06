"""Manager for WebSocket connections within rooms."""

import logging
from collections.abc import Callable
from typing import TYPE_CHECKING

from fastapi import WebSocket

if TYPE_CHECKING:
    from app.services.core.room_repository import RoomRepository

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for rooms.

    This class is responsible for:
    - Attaching WebSocket connections to registered players
    - Detaching connections when players disconnect
    - Broadcasting state to all connected players in a room
    """

    def __init__(self, room_repository: "RoomRepository") -> None:
        """Initialize the connection manager.

        Args:
            room_repository: Repository for accessing room data
        """
        self._room_repository = room_repository

    def attach(self, room_id: str, player_id: str, websocket: WebSocket) -> bool:
        """Attach a WebSocket connection to a registered player.

        Args:
            room_id: The room ID
            player_id: The player ID (must be pre-registered)
            websocket: The player's WebSocket connection

        Returns:
            bool: True if attachment successful, False if player not registered
        """
        room = self._room_repository.get(room_id)
        if not room or player_id not in room.players:
            return False

        room.connections[player_id] = websocket
        logger.info(
            f"WebSocket attached: room_id={room_id}, player_id={player_id}, "
            f"connected_players={len(room.connections)}"
        )
        return True

    def detach(self, room_id: str, player_id: str) -> None:
        """Detach a WebSocket connection from a player.

        The player remains registered but without an active connection.

        Args:
            room_id: The room ID
            player_id: The player ID
        """
        room = self._room_repository.get(room_id)
        if room and player_id in room.connections:
            del room.connections[player_id]
            logger.info(
                f"WebSocket detached: room_id={room_id}, player_id={player_id}, "
                f"remaining_connections={list(room.connections.keys())}"
            )

    async def broadcast(self, room_id: str, state: dict) -> None:
        """Broadcast room state to all connected players.

        Args:
            room_id: The room ID
            state: The state dictionary to broadcast
        """
        room = self._room_repository.get(room_id)
        if not room:
            return

        for player_id, ws in room.connections.items():
            try:
                await ws.send_json(state)
            except Exception as e:
                logger.warning(
                    f"Failed to broadcast to player: room_id={room_id}, "
                    f"player_id={player_id}, error={e!s}"
                )

    async def broadcast_per_recipient(
        self, room_id: str, build_state: Callable[[str], dict]
    ) -> None:
        """Broadcast a per-recipient payload to every connected player.

        Calls build_state(player_id) for each connected player and sends the
        resulting dict to that player's WebSocket. Snapshots the connection list
        before iterating so concurrent disconnects cannot cause a
        RuntimeError: dictionary changed size during iteration.

        Args:
            room_id: The room ID
            build_state: Callable that takes a player_id and returns the payload
        """
        room = self._room_repository.get(room_id)
        if not room:
            return

        for player_id, ws in list(room.connections.items()):
            try:
                await ws.send_json(build_state(player_id))
            except Exception as e:
                logger.warning(
                    f"Failed to send per-recipient state: room_id={room_id}, "
                    f"player_id={player_id}, error={e!s}"
                )

    async def send_to_player(self, room_id: str, player_id: str, state: dict) -> None:
        """Send a state payload to a single player's WebSocket.

        Args:
            room_id: The room ID
            player_id: The target player
            state: The payload to send
        """
        room = self._room_repository.get(room_id)
        if not room:
            return

        ws = room.connections.get(player_id)
        if ws is None:
            logger.warning(
                f"send_to_player: player not connected: "
                f"room_id={room_id}, player_id={player_id}"
            )
            return

        try:
            await ws.send_json(state)
        except Exception as e:
            logger.warning(
                f"Failed to send to player: room_id={room_id}, "
                f"player_id={player_id}, error={e!s}"
            )

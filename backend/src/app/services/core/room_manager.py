"""Room manager for handling game rooms and player connections."""

import logging
import random
import string

from fastapi import WebSocket

from app.db import get_random_questions
from app.models import Question, Room


class RoomManager:
    """Manages game rooms and player connections.

    Supports a two-phase player registration:
    1. HTTP phase: register_player() reserves the player name
    2. WebSocket phase: attach_connection() binds the WebSocket

    This decoupling enables deep linking and proper HTTP error handling.
    """

    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.logger = logging.getLogger(__name__)

    def create_room(self) -> Room:
        """Create a room with a unique room code.

        Returns:
            The newly created Room
        """
        room_id: str = self._generate_unique_room_code()
        questions: list[Question] = get_random_questions(count=10)
        self.rooms[room_id] = Room(room_id, questions)

        self.logger.info(f"Room created: room_id={room_id}")
        return self.rooms[room_id]

    def get_room(self, room_id: str) -> Room | None:
        """Get a room by ID.

        Args:
            room_id: The room ID

        Returns:
            The room or None if not found
        """
        return self.rooms.get(room_id)

    def delete_room(self, room_id: str) -> None:
        """Delete a room.

        Args:
            room_id: The room ID to delete
        """
        if room_id in self.rooms:
            del self.rooms[room_id]
            self.logger.info(f"Room deleted: room_id={room_id}")

    def register_player(self, room_id: str, player_id: str) -> bool:
        """Pre-register a player in a room (HTTP phase).

        This reserves the player name without requiring a WebSocket connection.
        Called from HTTP endpoint before WebSocket connection is established.

        Args:
            room_id: The room ID
            player_id: The player ID to register

        Returns:
            bool: True if registration successful, False if name taken
        """
        room = self.get_room(room_id)
        if not room:
            return False

        if player_id in room.players:
            return False

        room.players.add(player_id)
        room.scores[player_id] = 0
        self.logger.info(
            f"Player registered: room_id={room_id}, player_id={player_id}, "
            f"total_players={len(room.players)}"
        )
        return True

    def attach_connection(
        self, room_id: str, player_id: str, websocket: WebSocket
    ) -> bool:
        """Attach a WebSocket connection to a registered player (WebSocket phase).

        Args:
            room_id: The room ID
            player_id: The player ID (must be pre-registered)
            websocket: The player's WebSocket connection

        Returns:
            bool: True if attachment successful, False if player not registered
        """
        room = self.get_room(room_id)
        if not room or player_id not in room.players:
            return False

        room.connections[player_id] = websocket
        self.logger.info(
            f"WebSocket attached: room_id={room_id}, player_id={player_id}, "
            f"connected_players={len(room.connections)}"
        )
        return True

    def detach_connection(self, room_id: str, player_id: str) -> None:
        """Detach a WebSocket connection from a player.

        The player remains registered but without an active connection.

        Args:
            room_id: The room ID
            player_id: The player ID
        """
        room = self.get_room(room_id)
        if room and player_id in room.connections:
            del room.connections[player_id]
            self.logger.info(
                f"WebSocket detached: room_id={room_id}, player_id={player_id}"
            )

    def _generate_unique_room_code(self) -> str:
        """Generate a unique 4-character alphanumeric room code.

        Returns:
            A unique room code in uppercase
        """
        max_attempts = 100
        for _ in range(max_attempts):
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
            if code not in self.rooms:
                return code

        return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    async def broadcast_state(self, room_id: str, state: dict) -> None:
        """Broadcast room state to all connected players.

        Args:
            room_id: The room ID
            state: The state dictionary to broadcast
        """
        if room_id not in self.rooms:
            return

        room = self.rooms[room_id]

        for player_id, ws in room.connections.items():
            try:
                await ws.send_json(state)
            except Exception as e:
                self.logger.warning(
                    f"Failed to broadcast to player: room_id={room_id}, "
                    f"player_id={player_id}, error={e!s}"
                )

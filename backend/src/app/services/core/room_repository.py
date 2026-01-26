"""Repository for room storage and CRUD operations."""

import logging
import random
import string
from typing import TYPE_CHECKING

from app.models import Room

if TYPE_CHECKING:
    from app.models import Question

logger = logging.getLogger(__name__)


class RoomRepository:
    """Manages room lifecycle and storage.

    This class is responsible for:
    - Creating and storing rooms
    - Retrieving rooms by ID
    - Deleting rooms
    - Player registration (which is tied to room state)
    """

    def __init__(self) -> None:
        """Initialize the repository."""
        self._rooms: dict[str, Room] = {}

    @property
    def rooms(self) -> dict[str, Room]:
        """Access to the rooms dictionary for backward compatibility."""
        return self._rooms

    def create(self, questions: list["Question"]) -> Room:
        """Create a room with a unique room code.

        Args:
            questions: List of questions for the game

        Returns:
            The newly created Room
        """
        room_id = self._generate_unique_room_code()
        self._rooms[room_id] = Room(room_id, questions)

        logger.info(f"Room created: room_id={room_id}")
        return self._rooms[room_id]

    def get(self, room_id: str) -> Room | None:
        """Get a room by ID.

        Args:
            room_id: The room ID

        Returns:
            The room or None if not found
        """
        return self._rooms.get(room_id)

    def delete(self, room_id: str) -> None:
        """Delete a room.

        Args:
            room_id: The room ID to delete
        """
        if room_id in self._rooms:
            del self._rooms[room_id]
            logger.info(f"Room deleted: room_id={room_id}")

    def register_player(self, room_id: str, player_id: str) -> bool:
        """Pre-register a player in a room.

        This reserves the player name without requiring a WebSocket connection.

        Args:
            room_id: The room ID
            player_id: The player ID to register

        Returns:
            bool: True if registration successful, False if room not found or name taken
        """
        room = self.get(room_id)
        if not room:
            return False

        if player_id in room.players:
            return False

        room.players.add(player_id)
        room.scores[player_id] = 0
        logger.info(
            f"Player registered: room_id={room_id}, player_id={player_id}, "
            f"total_players={len(room.players)}"
        )
        return True

    def _generate_unique_room_code(self) -> str:
        """Generate a unique 4-character alphanumeric room code.

        Returns:
            A unique room code in uppercase
        """
        max_attempts = 100
        for _ in range(max_attempts):
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
            if code not in self._rooms:
                return code

        return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

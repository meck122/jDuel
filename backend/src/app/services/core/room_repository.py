"""Repository for room storage and CRUD operations."""

import logging
import secrets
import string
from typing import TYPE_CHECKING

from app.config.game import MAX_PLAYERS_PER_ROOM, MAX_ROOMS
from app.models import Room


class RoomLimitExceeded(Exception):
    """Raised when the global room cap is reached."""


class RoomFull(Exception):
    """Raised when a room's player cap is reached."""


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

        Raises:
            RoomLimitExceeded: If the global room cap is reached
        """
        if len(self._rooms) >= MAX_ROOMS:
            raise RoomLimitExceeded(
                f"Server at capacity ({MAX_ROOMS} rooms). Try again later."
            )
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

        Safety: This method is called from the HTTP route (not the orchestrator)
        and is NOT covered by the per-room asyncio.Lock. This is safe because
        it is synchronous with no await points — the event loop cannot yield
        mid-execution. Do not add await calls here without also acquiring the lock.

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

        if len(room.players) >= MAX_PLAYERS_PER_ROOM:
            raise RoomFull(f"Room is full ({MAX_PLAYERS_PER_ROOM} players max).")

        room.players.add(player_id)
        room.scores[player_id] = 0
        if room.host_id is None:
            room.host_id = player_id
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
        alphabet = string.ascii_uppercase + string.digits
        max_attempts = 100
        for _ in range(max_attempts):
            code = "".join(secrets.choice(alphabet) for _ in range(4))
            if code not in self._rooms:
                return code

        return "".join(secrets.choice(alphabet) for _ in range(6))

"""Room manager - facade for room and connection management.

This module provides backward-compatible access to room operations by
delegating to specialized services: RoomRepository and ConnectionManager.
"""

import logging
from typing import TYPE_CHECKING

from fastapi import WebSocket

from app.models import Room
from app.services.core.connection_manager import ConnectionManager
from app.services.core.question_provider import (
    DatabaseQuestionProvider,
    QuestionProvider,
)
from app.services.core.room_repository import RoomRepository

if TYPE_CHECKING:
    from app.models import Question

logger = logging.getLogger(__name__)


class RoomManager:
    """Facade for room and connection management.

    This class delegates to specialized services while maintaining
    the existing API for backward compatibility:
    - RoomRepository: Room CRUD and player registration
    - ConnectionManager: WebSocket connection handling

    Supports a two-phase player registration:
    1. HTTP phase: register_player() reserves the player name
    2. WebSocket phase: attach_connection() binds the WebSocket
    """

    def __init__(
        self,
        room_repository: RoomRepository | None = None,
        connection_manager: ConnectionManager | None = None,
        question_provider: QuestionProvider | None = None,
    ):
        """Initialize the room manager.

        Args:
            room_repository: Optional repository instance (created if not provided)
            connection_manager: Optional connection manager (created if not provided)
            question_provider: Optional question provider (defaults to DatabaseQuestionProvider)
        """
        self._repository = room_repository or RoomRepository()
        self._connection_manager = connection_manager or ConnectionManager(
            self._repository
        )
        self._question_provider = question_provider or DatabaseQuestionProvider()

    @property
    def rooms(self) -> dict[str, Room]:
        """Access to rooms dictionary for backward compatibility."""
        return self._repository.rooms

    @property
    def repository(self) -> RoomRepository:
        """Access to the underlying room repository."""
        return self._repository

    @property
    def connection_manager(self) -> ConnectionManager:
        """Access to the underlying connection manager."""
        return self._connection_manager

    def create_room(self, questions: list["Question"] | None = None) -> Room:
        """Create a room with a unique room code.

        Args:
            questions: Optional list of questions. If not provided, uses question provider.

        Returns:
            The newly created Room
        """
        if questions is None:
            questions = self._question_provider.get_questions(count=10)
        return self._repository.create(questions)

    def get_room(self, room_id: str) -> Room | None:
        """Get a room by ID.

        Args:
            room_id: The room ID

        Returns:
            The room or None if not found
        """
        return self._repository.get(room_id)

    def delete_room(self, room_id: str) -> None:
        """Delete a room.

        Args:
            room_id: The room ID to delete
        """
        self._repository.delete(room_id)

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
        return self._repository.register_player(room_id, player_id)

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
        return self._connection_manager.attach(room_id, player_id, websocket)

    def detach_connection(self, room_id: str, player_id: str) -> None:
        """Detach a WebSocket connection from a player.

        The player remains registered but without an active connection.

        Args:
            room_id: The room ID
            player_id: The player ID
        """
        self._connection_manager.detach(room_id, player_id)

    async def broadcast_state(self, room_id: str, state: dict) -> None:
        """Broadcast room state to all connected players.

        Args:
            room_id: The room ID
            state: The state dictionary to broadcast
        """
        await self._connection_manager.broadcast(room_id, state)

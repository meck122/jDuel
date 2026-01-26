"""Protocol definitions for orchestration services."""

from typing import Protocol


class RoomCloser(Protocol):
    """Protocol for closing rooms and notifying clients.

    This protocol defines the interface for room cleanup operations,
    allowing different implementations (e.g., with or without WebSocket notifications).
    """

    async def close_room(self, room_id: str) -> None:
        """Close room and notify all connected clients.

        Args:
            room_id: The ID of the room to close
        """
        ...

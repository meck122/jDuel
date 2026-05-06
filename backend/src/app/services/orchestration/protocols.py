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


class GameOverTimerStarter(Protocol):
    """Protocol for scheduling the post-game 60s auto-close timer.

    The SpeedBattleHandler calls this after match end to reuse the
    same 60s play-again window Classic uses (Decision § 10).
    """

    def start_game_over_timer(self, room_id: str) -> None:
        """Schedule the 60-second game-over auto-close timer.

        Args:
            room_id: The ID of the finished room
        """
        ...

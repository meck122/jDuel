"""Room manager for handling game rooms and player connections."""

import logging

from fastapi import WebSocket

from app.db import get_random_questions
from app.models import Room


class RoomManager:
    """Manages game rooms and player connections."""

    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.logger = logging.getLogger(__name__)

    def create_or_get_room(self, room_id: str) -> Room:
        """Create a new room or return existing one."""
        if room_id not in self.rooms:
            # Get random questions from database
            questions = get_random_questions(count=10)
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

    def add_player(self, room_id: str, player_id: str, websocket: WebSocket) -> None:
        """Add a player to a room.

        Args:
            room_id: The room ID
            player_id: The player ID
            websocket: The player's WebSocket connection
        """
        room = self.create_or_get_room(room_id)
        room.players[player_id] = websocket
        room.scores[player_id] = 0
        self.logger.info(
            f"Player joined: room_id={room_id}, player_id={player_id}, total_players={len(room.players)}"
        )

    def remove_player(self, room_id: str, player_id: str) -> None:
        """Remove a player from a room and clean up empty rooms.

        Args:
            room_id: The room ID
            player_id: The player ID to remove
        """
        if room_id not in self.rooms:
            return

        room = self.rooms[room_id]
        if player_id in room.players:
            del room.players[player_id]
        if player_id in room.scores:
            del room.scores[player_id]

        self.logger.info(
            f"Player left: room_id={room_id}, player_id={player_id}, remaining_players={len(room.players)}"
        )

        # Clean up empty rooms
        if not room.players:
            self.logger.info(f"Room deleted (empty): room_id={room_id}")
            del self.rooms[room_id]

    async def broadcast_state(self, room_id: str, state: dict) -> None:
        """Broadcast room state to all connected players.

        Args:
            room_id: The room ID
            state: The state dictionary to broadcast
        """
        if room_id not in self.rooms:
            return

        room = self.rooms[room_id]

        disconnected = []
        for player_id, ws in room.players.items():
            try:
                await ws.send_json(state)
            except Exception as e:
                self.logger.warning(
                    f"Failed to broadcast to player: room_id={room_id}, player_id={player_id}, error={e!s}"
                )
                disconnected.append(player_id)

        # Clean up disconnected players
        for player_id in disconnected:
            self.remove_player(room_id, player_id)

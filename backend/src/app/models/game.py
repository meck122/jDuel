"""Data models for the trivia game."""

from datetime import datetime
from enum import Enum

from fastapi import WebSocket

from app.models.question import Question


class GameStatus(str, Enum):
    """Enum for game status."""

    WAITING = "waiting"
    PLAYING = "playing"
    RESULTS = "results"
    FINISHED = "finished"


class Room:
    """Represents a game room with players and state.

    Players are decoupled from WebSocket connections to support HTTP pre-registration
    followed by WebSocket connection. This enables:
    - Deep linking: Users can share room URLs before connecting
    - Better error handling: Validate room/player via HTTP before WebSocket
    - Reconnection: Players can reconnect to their slot after disconnect
    """

    def __init__(self, room_id: str, questions: list[Question]):
        self.room_id = room_id
        # Registered players and their scores (identity layer)
        self.players: set[str] = set()
        self.scores: dict[str, int] = {}
        # Active WebSocket connections (connection layer)
        self.connections: dict[str, WebSocket] = {}
        self.status = GameStatus.WAITING
        self.question_index = 0
        self.questions = questions.copy()
        self.question_start_time: datetime | None = None
        self.answered_players: set[str] = set()
        self.player_answers: dict[str, str] = {}
        self.correct_players: set[str] = (
            set()
        )  # Players who answered correctly (need to calculate correct score)
        self.question_points: dict[
            str, int
        ] = {}  # Points gained by each player in current question
        self.results_start_time: datetime | None = None
        self.finish_time: datetime | None = None

    def is_player_connected(self, player_id: str) -> bool:
        """Check if a player has an active WebSocket connection."""
        return player_id in self.connections

    def get_connected_players(self) -> list[str]:
        """Get list of players with active WebSocket connections."""
        return list(self.connections.keys())

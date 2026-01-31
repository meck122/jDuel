"""Data models for the trivia game."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from fastapi import WebSocket

from app.models.question import Question
from app.models.room_config import RoomConfig
from app.models.round_state import RoundState


class GameStatus(str, Enum):
    """Enum for game status."""

    WAITING = "waiting"
    PLAYING = "playing"
    RESULTS = "results"
    FINISHED = "finished"


@dataclass
class Room:
    """Represents a game room with players and state.

    Players are decoupled from WebSocket connections to support HTTP pre-registration
    followed by WebSocket connection. This enables:
    - Deep linking: Users can share room URLs before connecting
    - Better error handling: Validate room/player via HTTP before WebSocket
    - Reconnection: Players can reconnect to their slot after disconnect

    The room separates concerns into:
    - Identity layer: players, scores
    - Connection layer: connections (WebSocket)
    - Game state: status, question_index, questions
    - Round state: current_round (per-question state)
    - Timestamps: results_start_time, finish_time
    """

    room_id: str
    questions: list[Question] = field(default_factory=list)
    # Registered players and their scores (identity layer)
    players: set[str] = field(default_factory=set)
    scores: dict[str, int] = field(default_factory=dict)
    # Host is the first player to join; controls room configuration
    host_id: str | None = None
    # Active WebSocket connections (connection layer)
    connections: dict[str, WebSocket] = field(default_factory=dict)
    # Game state
    status: GameStatus = GameStatus.WAITING
    question_index: int = 0
    # Host-controlled room configuration
    config: RoomConfig = field(default_factory=RoomConfig)
    # Per-question round state
    current_round: RoundState = field(default_factory=RoundState)
    # Timestamps
    results_start_time: datetime | None = None
    finish_time: datetime | None = None
    # Session tokens for secure reconnection (player_id -> token)
    session_tokens: dict[str, str] = field(default_factory=dict)

    def __init__(self, room_id: str, questions: list[Question]):
        """Initialize a room.

        Args:
            room_id: Unique identifier for the room
            questions: List of questions for the game
        """
        self.room_id = room_id
        self.questions = questions.copy()
        self.players = set()
        self.scores = {}
        self.host_id = None
        self.connections = {}
        self.status = GameStatus.WAITING
        self.question_index = 0
        self.config = RoomConfig()
        self.current_round = RoundState()
        self.results_start_time = None
        self.finish_time = None
        self.session_tokens = {}

    # Backward-compatible property accessors for round state
    @property
    def question_start_time(self) -> datetime | None:
        """Get the current question's start time."""
        return self.current_round.question_start_time

    @question_start_time.setter
    def question_start_time(self, value: datetime | None) -> None:
        """Set the current question's start time."""
        self.current_round.question_start_time = value

    @property
    def answered_players(self) -> set[str]:
        """Get players who have answered the current question."""
        return self.current_round.answered_players

    @answered_players.setter
    def answered_players(self, value: set[str]) -> None:
        """Set the answered players set."""
        self.current_round.answered_players = value

    @property
    def player_answers(self) -> dict[str, str]:
        """Get the answers submitted by players."""
        return self.current_round.player_answers

    @player_answers.setter
    def player_answers(self, value: dict[str, str]) -> None:
        """Set the player answers dict."""
        self.current_round.player_answers = value

    @property
    def correct_players(self) -> set[str]:
        """Get players who answered correctly."""
        return self.current_round.correct_players

    @correct_players.setter
    def correct_players(self, value: set[str]) -> None:
        """Set the correct players set."""
        self.current_round.correct_players = value

    @property
    def question_points(self) -> dict[str, int]:
        """Get points earned by each player this round."""
        return self.current_round.question_points

    @question_points.setter
    def question_points(self, value: dict[str, int]) -> None:
        """Set the question points dict."""
        self.current_round.question_points = value

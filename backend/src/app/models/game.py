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
    """Represents a game room with players and state."""

    def __init__(self, room_id: str, questions: list[Question]):
        self.room_id = room_id
        self.players: dict[str, WebSocket] = {}
        self.scores: dict[str, int] = {}
        self.status = GameStatus.WAITING
        self.question_index = 0
        self.questions = questions.copy()
        self.question_start_time: datetime | None = None
        self.answered_players: set[str] = set()
        self.player_answers: dict[str, str] = {}
        self.results_start_time: datetime | None = None
        self.finish_time: datetime | None = None

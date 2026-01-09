"""Data models for the trivia game."""

from typing import Dict, Set, Optional
from datetime import datetime
from fastapi import WebSocket
from enum import Enum


class GameStatus(str, Enum):
    """Enum for game status."""

    WAITING = "waiting"
    PLAYING = "playing"
    RESULTS = "results"
    FINISHED = "finished"


class Room:
    """Represents a game room with players and state."""

    def __init__(self, room_id: str, questions: list):
        self.room_id = room_id
        self.players: Dict[str, WebSocket] = {}
        self.scores: Dict[str, int] = {}
        self.status = GameStatus.WAITING
        self.question_index = 0
        self.questions = questions.copy()
        self.question_start_time: Optional[datetime] = None
        self.answered_players: Set[str] = set()
        self.player_answers: Dict[str, str] = {}  # Track player answers
        self.results_start_time: Optional[datetime] = None
        self.finish_time: Optional[datetime] = None

    def to_dict(self) -> dict:
        """Convert room to dictionary for JSON serialization."""
        return {
            "players": self.players,
            "scores": self.scores,
            "status": self.status,
            "question_index": self.question_index,
            "questions": self.questions,
            "question_start_time": self.question_start_time,
            "answered_players": self.answered_players,
            "player_answers": self.player_answers,
            "results_start_time": self.results_start_time,
            "finish_time": self.finish_time,
        }

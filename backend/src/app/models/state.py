"""Typed state models for WebSocket communication."""

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class CurrentQuestion:
    """Current question state sent to clients."""

    text: str
    category: str


@dataclass
class ResultsData:
    """Results state sent to clients."""

    correctAnswer: str
    playerAnswers: dict[str, str]


@dataclass
class RoomStateData:
    """Room state data sent to clients."""

    roomId: str
    players: dict[str, int]
    status: Literal["waiting", "playing", "results", "finished"]
    questionIndex: int
    currentQuestion: CurrentQuestion | None = None
    timeRemainingMs: int | None = None
    winner: str | None = None
    results: ResultsData | None = None


@dataclass
class RoomStateMessage:
    """WebSocket message containing room state."""

    type: Literal["ROOM_STATE"] = field(default="ROOM_STATE", init=False)
    roomState: RoomStateData | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result: dict = {"type": self.type}
        if self.roomState:
            state_dict: dict = {
                "roomId": self.roomState.roomId,
                "players": self.roomState.players,
                "status": self.roomState.status,
                "questionIndex": self.roomState.questionIndex,
            }
            if self.roomState.currentQuestion:
                state_dict["currentQuestion"] = {
                    "text": self.roomState.currentQuestion.text,
                    "category": self.roomState.currentQuestion.category,
                }
            if self.roomState.timeRemainingMs is not None:
                state_dict["timeRemainingMs"] = self.roomState.timeRemainingMs
            if self.roomState.winner:
                state_dict["winner"] = self.roomState.winner
            if self.roomState.results:
                state_dict["results"] = {
                    "correctAnswer": self.roomState.results.correctAnswer,
                    "playerAnswers": self.roomState.results.playerAnswers,
                }
            result["roomState"] = state_dict
        return result

"""Typed state models for WebSocket communication using Pydantic."""

from typing import Literal

from pydantic import BaseModel


class RoomConfigData(BaseModel):
    """Room configuration sent to clients."""

    multipleChoiceEnabled: bool = False


class CurrentQuestion(BaseModel):
    """Current question state sent to clients."""

    text: str
    category: str
    options: list[str] | None = None


class ResultsData(BaseModel):
    """Results state sent to clients."""

    correctAnswer: str
    playerAnswers: dict[str, str]
    playerResults: dict[str, int]  # Map of player ID to points gained (0 if incorrect)


class RoomStateData(BaseModel):
    """Room state data sent to clients."""

    roomId: str
    players: dict[str, int]
    status: Literal["waiting", "playing", "results", "finished"]
    questionIndex: int
    hostId: str | None = None
    config: RoomConfigData | None = None
    currentQuestion: CurrentQuestion | None = None
    timeRemainingMs: int | None = None
    winner: str | None = None
    results: ResultsData | None = None


class RoomStateMessage(BaseModel):
    """WebSocket message containing room state."""

    type: Literal["ROOM_STATE"] = "ROOM_STATE"
    roomState: RoomStateData | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization.

        Uses Pydantic's model_dump with exclude_none to match
        the previous manual serialization behavior.
        """
        return self.model_dump(exclude_none=True)

"""Typed state models for WebSocket communication using Pydantic."""

from typing import Literal

from pydantic import BaseModel


class ReactionData(BaseModel):
    """A single reaction option sent to clients."""

    id: int
    label: str


class RoomConfigData(BaseModel):
    """Room configuration sent to clients."""

    multipleChoiceEnabled: bool = False
    difficulty: str = "enjoyer"
    gameMode: Literal["classic", "speed_battle"] = "classic"


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


class SpeedBattleLeaderRow(BaseModel):
    """One row in the Speed Battle leaderboard."""

    playerId: str
    correctCount: int
    wrongCount: int
    placement: int


class SpeedBattlePlayerState(BaseModel):
    """Per-recipient Speed Battle player state."""

    questionIndex: int
    correctCount: int
    wrongCount: int
    cooldownRemainingMs: int | None = None
    cooldownCorrectAnswer: str | None = None
    exhausted: bool = False


class SpeedBattleStateData(BaseModel):
    """Speed Battle block on RoomStateData — present only in Speed Battle rooms."""

    matchRemainingMs: int
    playerState: SpeedBattlePlayerState
    leaderboard: list[SpeedBattleLeaderRow] | None = None


class RoomStateData(BaseModel):
    """Room state data sent to clients."""

    roomId: str
    players: dict[str, int]
    status: Literal["waiting", "playing", "results", "finished"]
    questionIndex: int
    totalQuestions: int = 0
    hostId: str | None = None
    config: RoomConfigData | None = None
    currentQuestion: CurrentQuestion | None = None
    timeRemainingMs: int | None = None
    winner: str | None = None
    results: ResultsData | None = None
    reactions: list[ReactionData] | None = None
    speedBattle: SpeedBattleStateData | None = None


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

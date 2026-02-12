"""Pydantic models for WebSocket message validation."""

from typing import Literal

from pydantic import BaseModel, Field

from app.config import MAX_ANSWER_LENGTH


class StartGameMessage(BaseModel):
    """Message to start the game (host only)."""

    type: Literal["START_GAME"]


class AnswerMessage(BaseModel):
    """Message to submit an answer."""

    type: Literal["ANSWER"]
    answer: str = Field(..., max_length=MAX_ANSWER_LENGTH)


class UpdateConfigMessage(BaseModel):
    """Message to update room configuration (host only)."""

    type: Literal["UPDATE_CONFIG"]
    config: dict = Field(default_factory=dict)


class ReactionMessage(BaseModel):
    """Message to send a reaction (playing/results phase only)."""

    type: Literal["REACTION"]
    reactionId: int


class PlayAgainMessage(BaseModel):
    """Message to reset room to lobby (host only, finished state only)."""

    type: Literal["PLAY_AGAIN"]


class WebSocketClientMessage(BaseModel):
    """Union type for all client-to-server WebSocket messages.

    Use this for initial type detection, then validate with specific model.
    """

    type: Literal["START_GAME", "ANSWER", "UPDATE_CONFIG", "REACTION", "PLAY_AGAIN"]

"""Configuration package - centralizes all app configuration."""

from app.config.environment import CORS_ORIGINS
from app.config.game import (
    DIFFICULTY_RANGES,
    GAME_OVER_TIME_MS,
    MAX_ANSWER_LENGTH,
    MAX_PLAYER_NAME_LENGTH,
    MAX_SCORE_PER_QUESTION,
    QUESTION_TIME_MS,
    RATE_LIMIT_ROOM_CREATE,
    RATE_LIMIT_ROOM_JOIN,
    RATE_LIMIT_WS_MESSAGES,
    REACTION_COOLDOWN_MS,
    REACTIONS,
    RESULTS_TIME_MS,
    ROOM_ID_PATTERN,
)
from app.config.logging import setup_logging

__all__ = [
    "CORS_ORIGINS",
    "DIFFICULTY_RANGES",
    "GAME_OVER_TIME_MS",
    "MAX_ANSWER_LENGTH",
    "MAX_PLAYER_NAME_LENGTH",
    "MAX_SCORE_PER_QUESTION",
    "QUESTION_TIME_MS",
    "RATE_LIMIT_ROOM_CREATE",
    "RATE_LIMIT_ROOM_JOIN",
    "RATE_LIMIT_WS_MESSAGES",
    "REACTIONS",
    "REACTION_COOLDOWN_MS",
    "RESULTS_TIME_MS",
    "ROOM_ID_PATTERN",
    "setup_logging",
]

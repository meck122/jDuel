"""Configuration package - centralizes all app configuration."""

from app.config.environment import CORS_ORIGINS
from app.config.game import (
    GAME_OVER_TIME_MS,
    MAX_SCORE_PER_QUESTION,
    QUESTION_TIME_MS,
    RESULTS_TIME_MS,
)
from app.config.logging import setup_logging

__all__ = [
    "CORS_ORIGINS",
    "GAME_OVER_TIME_MS",
    "MAX_SCORE_PER_QUESTION",
    "QUESTION_TIME_MS",
    "RESULTS_TIME_MS",
    "setup_logging",
]

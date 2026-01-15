"""Configuration constants for the trivia game."""

import logging
import os
import sys

QUESTION_TIME_MS = 15000  # 10 seconds per question
MAX_SCORE_PER_QUESTION = 1000
RESULTS_TIME_MS = 10000  # 10 seconds for results screen
GAME_OVER_TIME_MS = 60000  # 60 seconds (1 minute) before closing room

# Environmnet-specific config # TODO: this code kinda nasty
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS_ORIGINS = (
    [FRONTEND_URL, "http://127.0.0.1:3000"]
    if "localhost" in FRONTEND_URL
    else [
        FRONTEND_URL,
        FRONTEND_URL.replace("://", "://www."),
        FRONTEND_URL.replace("://www.", "://"),
    ]
)


def setup_logging():
    """Configure application logging."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    logging.basicConfig(
        level=getattr(logging, log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

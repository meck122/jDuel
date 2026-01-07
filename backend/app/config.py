"""Configuration constants for the trivia game."""

import os

QUESTION_TIME_MS = 10000  # 10 seconds per question
MAX_SCORE_PER_QUESTION = 1000
RESULTS_TIME_MS = 10000  # 10 seconds for results screen
GAME_OVER_TIME_MS = 60000  # 60 seconds (1 minute) before closing room

# Environmnet-specific config
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
CORS_ORIGINS = [FRONTEND_URL, "http://127.0.0.1:5173"] if "localhost" in FRONTEND_URL else [FRONTEND_URL]

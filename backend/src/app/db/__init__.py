"""Database access layer."""

from app.db.database import (
    get_random_questions,
    get_random_questions_by_difficulty,
    init_database,
)

__all__ = [
    "get_random_questions",
    "get_random_questions_by_difficulty",
    "init_database",
]

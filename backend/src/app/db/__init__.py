"""Database access layer."""

from app.db.database import get_random_questions, init_database

__all__ = ["get_random_questions", "init_database"]

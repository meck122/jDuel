"""Database access layer."""

from app.db.database import init_database, get_random_questions

__all__ = ["init_database", "get_random_questions"]

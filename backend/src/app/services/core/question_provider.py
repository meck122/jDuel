"""Question provider abstraction for loading game questions."""

from typing import Protocol

from app.models import Question


class QuestionProvider(Protocol):
    """Protocol for providing questions to games.

    This abstraction allows different question sources:
    - Database (production)
    - In-memory list (testing)
    - External API (future)
    """

    def get_questions(self, count: int) -> list[Question]:
        """Get a specified number of questions.

        Args:
            count: Number of questions to retrieve

        Returns:
            List of Question objects
        """
        ...


class DatabaseQuestionProvider:
    """Question provider that loads from the database."""

    def get_questions(self, count: int) -> list[Question]:
        """Get random questions from the database.

        Args:
            count: Number of questions to retrieve

        Returns:
            List of Question objects
        """
        from app.db import get_random_questions

        return get_random_questions(count)


class StaticQuestionProvider:
    """Question provider with a fixed list of questions.

    Useful for testing or demo purposes.
    """

    def __init__(self, questions: list[Question]) -> None:
        """Initialize with a list of questions.

        Args:
            questions: List of questions to provide
        """
        self._questions = questions

    def get_questions(self, count: int) -> list[Question]:
        """Get questions from the static list.

        Args:
            count: Number of questions to retrieve

        Returns:
            List of Question objects (up to count or all available)
        """
        return self._questions[:count]

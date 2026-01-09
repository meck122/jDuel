"""Question data model."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Question:
    """Represents a trivia question.

    Frozen to prevent accidental mutation during gameplay.
    """

    text: str
    answer: str
    category: str

    def __post_init__(self):
        """Validate question data."""
        if not self.text or not self.text.strip():
            raise ValueError("Question text cannot be empty")
        if not self.answer or not self.answer.strip():
            raise ValueError("Question answer cannot be empty")
        if not self.category or not self.category.strip():
            raise ValueError("Question category cannot be empty")

"""Root pytest fixtures shared by unit and integration tiers."""

import pytest

from app.models import Question
from app.services.core.question_provider import StaticQuestionProvider


class MockAnswerService:
    """Mock AnswerService that avoids loading heavy NLP models.

    Uses simple string comparison for testing purposes.
    """

    def is_correct(self, user_answer: str, correct_answer: str) -> bool:
        """Check if answer is correct using simple comparison."""
        return user_answer.lower().strip() == correct_answer.lower().strip()


@pytest.fixture
def mock_answer_service() -> MockAnswerService:
    """Provide a mock AnswerService for testing."""
    return MockAnswerService()


@pytest.fixture
def sample_questions() -> list[Question]:
    """Provide 10 sample questions for testing.

    Question index 2 includes wrong_answers for multiple-choice coverage.
    """
    return [
        Question(text="What is 2+2?", answer="4", category="Math"),
        Question(text="Capital of France?", answer="Paris", category="Geography"),
        Question(
            text="Who wrote Romeo and Juliet?",
            answer="Shakespeare",
            category="Literature",
            wrong_answers=("Dickens", "Tolstoy", "Hemingway"),
        ),
        Question(
            text="What is the largest planet?", answer="Jupiter", category="Science"
        ),
        Question(text="What color is the sky?", answer="Blue", category="Nature"),
        Question(
            text="How many sides does a triangle have?", answer="3", category="Math"
        ),
        Question(text="Capital of Germany?", answer="Berlin", category="Geography"),
        Question(text="What is H2O?", answer="Water", category="Science"),
        Question(text="How many days in a week?", answer="7", category="General"),
        Question(
            text="What is the speed of light unit?", answer="c", category="Physics"
        ),
    ]


@pytest.fixture
def static_question_provider(
    sample_questions: list[Question],
) -> StaticQuestionProvider:
    """Provide a StaticQuestionProvider backed by sample_questions."""
    return StaticQuestionProvider(sample_questions)

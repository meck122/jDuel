"""Pytest fixtures for jDuel backend tests."""

import pytest

from app.models import Question


@pytest.fixture
def sample_questions() -> list[Question]:
    """Provide sample questions for testing."""
    return [
        Question(text="What is 2+2?", answer="4", category="Math"),
        Question(text="Capital of France?", answer="Paris", category="Geography"),
        Question(text="Who wrote Romeo and Juliet?", answer="Shakespeare", category="Literature"),
    ]


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
def game_service(mock_answer_service: MockAnswerService):
    """Provide a GameService with mocked dependencies."""
    from app.services.core import GameService

    return GameService(mock_answer_service)


@pytest.fixture
def room_manager():
    """Provide a RoomManager for testing."""
    from app.services.core import RoomManager

    return RoomManager()


@pytest.fixture
def timer_service():
    """Provide a TimerService for testing."""
    from app.services.core import TimerService

    return TimerService()

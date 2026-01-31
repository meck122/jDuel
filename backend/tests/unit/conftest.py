"""Unit-tier fixtures — real service instances with test doubles."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.core.connection_manager import ConnectionManager
from app.services.core.game_service import GameService
from app.services.core.room_manager import RoomManager
from app.services.core.room_repository import RoomRepository
from app.services.core.timer_service import TimerService
from app.services.orchestration.orchestrator import GameOrchestrator
from app.services.orchestration.state_builder import StateBuilder


@pytest.fixture
def room_repository() -> RoomRepository:
    """Fresh RoomRepository instance."""
    return RoomRepository()


@pytest.fixture
def connection_manager(room_repository: RoomRepository) -> ConnectionManager:
    """ConnectionManager wired to the test repository."""
    return ConnectionManager(room_repository)


@pytest.fixture
def room_manager(static_question_provider) -> RoomManager:
    """RoomManager using StaticQuestionProvider (no DB)."""
    return RoomManager(question_provider=static_question_provider)


@pytest.fixture
def game_service(mock_answer_service) -> GameService:
    """GameService with mocked answer verification."""
    return GameService(mock_answer_service)


@pytest.fixture
def timer_service() -> TimerService:
    """Fresh TimerService instance."""
    return TimerService()


@pytest.fixture
def state_builder() -> StateBuilder:
    """Fresh StateBuilder instance."""
    return StateBuilder()


@pytest.fixture
def mock_room_closer() -> MagicMock:
    """MagicMock implementing the RoomCloser protocol."""
    closer = MagicMock()
    closer.close_room = AsyncMock()
    return closer


@pytest.fixture
def orchestrator(
    room_manager: RoomManager,
    game_service: GameService,
    timer_service: TimerService,
    state_builder: StateBuilder,
    mock_room_closer: MagicMock,
) -> GameOrchestrator:
    """GameOrchestrator with all real services except mocked room_closer."""
    return GameOrchestrator(
        room_manager=room_manager,
        game_service=game_service,
        timer_service=timer_service,
        state_builder=state_builder,
        room_closer=mock_room_closer,
    )

"""Integration-tier fixtures — app factory, TestClient, container wiring.

Why patch _container directly:
    websocket_handler.py calls get_container() at call time (not through
    FastAPI Depends), so dependency_overrides don't apply there. We set
    the module-level singleton so the handler picks up our test container.
"""

import contextlib

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.container import ServiceContainer
from app.services.core.game_service import GameService
from app.services.core.room_closer import WebSocketRoomCloser
from app.services.core.room_manager import RoomManager
from app.services.core.timer_service import TimerService
from app.services.orchestration.orchestrator import GameOrchestrator
from app.services.orchestration.state_builder import StateBuilder


@contextlib.asynccontextmanager
async def noop_lifespan(_app):
    """No-op lifespan — skips NLP model loading for tests."""
    yield


@pytest.fixture
def test_container(mock_answer_service, static_question_provider) -> ServiceContainer:
    """Wire a ServiceContainer with test doubles and set as the global singleton."""
    import app.services.container as container_mod

    room_manager = RoomManager(question_provider=static_question_provider)
    timer_service = TimerService()
    state_builder = StateBuilder()
    game_service = GameService(mock_answer_service)
    room_closer = WebSocketRoomCloser(room_manager, timer_service)
    orchestrator = GameOrchestrator(
        room_manager=room_manager,
        game_service=game_service,
        timer_service=timer_service,
        state_builder=state_builder,
        room_closer=room_closer,
    )

    container = ServiceContainer(
        answer_service=mock_answer_service,
        game_service=game_service,
        room_manager=room_manager,
        timer_service=timer_service,
        state_builder=state_builder,
        orchestrator=orchestrator,
    )

    # Patch the module-level singleton so get_container() returns our test container
    container_mod._container = container
    yield container
    # Restore to None after test
    container_mod._container = None


@pytest.fixture
def client(test_container: ServiceContainer) -> TestClient:  # noqa: ARG001
    """TestClient wrapping the app with noop lifespan.

    Depends on test_container to ensure services are initialized before
    requests are made.
    """
    # Reset rate limiters before each test to avoid 429 errors
    import app.middleware.rate_limiter as rate_limiter_mod

    rate_limiter_mod._room_create_limiter = None
    rate_limiter_mod._room_join_limiter = None
    rate_limiter_mod._ws_message_limiter = None

    app = create_app(lifespan_override=noop_lifespan)
    return TestClient(app)

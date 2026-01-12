"""Service container for dependency injection.

This module implements the Composition Root pattern - all service dependencies
are wired up in one place at startup, making the architecture easier to
understand, test, and maintain.
"""

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.answer_service import AnswerService
    from app.services.game_service import GameService
    from app.services.orchestrator import GameOrchestrator
    from app.services.room_manager import RoomManager
    from app.services.state_builder import StateBuilder
    from app.services.timer_service import TimerService

logger = logging.getLogger(__name__)


@dataclass
class ServiceContainer:
    """Holds all initialized service instances."""

    answer_service: "AnswerService"
    game_service: "GameService"
    room_manager: "RoomManager"
    timer_service: "TimerService"
    state_builder: "StateBuilder"
    orchestrator: "GameOrchestrator"


# Singleton instance - None until initialized
_container: ServiceContainer | None = None


def get_container() -> ServiceContainer:
    """Get the service container.

    Returns:
        The initialized ServiceContainer

    Raises:
        RuntimeError: If services have not been initialized
    """
    if _container is None:
        raise RuntimeError("Services not initialized. Call init_services() first.")
    return _container


def is_initialized() -> bool:
    """Check if services are initialized.

    Returns:
        True if the container has been initialized
    """
    return _container is not None


def init_services(answer_service: "AnswerService") -> ServiceContainer:
    """Initialize all services with dependencies.

    This is the composition root where all services are wired together.
    Should be called once during application startup.

    Args:
        answer_service: Pre-loaded AnswerService instance

    Returns:
        Initialized ServiceContainer
    """
    global _container

    # Import here to avoid circular imports
    from app.api.websocket_handler import WebSocketRoomCloser
    from app.services.game_service import GameService
    from app.services.orchestrator import GameOrchestrator
    from app.services.room_manager import RoomManager
    from app.services.state_builder import StateBuilder
    from app.services.timer_service import TimerService

    logger.info("Initializing service container...")

    # Create services in dependency order
    room_manager = RoomManager()
    timer_service = TimerService()
    state_builder = StateBuilder()
    game_service = GameService(answer_service)

    # RoomCloser needs room_manager and timer_service
    room_closer = WebSocketRoomCloser(room_manager, timer_service)

    # Orchestrator depends on all other services
    orchestrator = GameOrchestrator(
        room_manager=room_manager,
        game_service=game_service,
        timer_service=timer_service,
        state_builder=state_builder,
        room_closer=room_closer,
    )

    _container = ServiceContainer(
        answer_service=answer_service,
        game_service=game_service,
        room_manager=room_manager,
        timer_service=timer_service,
        state_builder=state_builder,
        orchestrator=orchestrator,
    )

    logger.info("Service container initialized")
    return _container

"""FastAPI dependency injection for services.

This module provides FastAPI Depends() wrappers for service injection,
enabling proper lifecycle management and easier testing.
"""

from typing import Annotated

from fastapi import Depends

from app.services.container import ServiceContainer, get_container


def get_services() -> ServiceContainer:
    """Get the service container for dependency injection.

    Returns:
        The initialized ServiceContainer
    """
    return get_container()


# Type alias for injecting the full service container
Services = Annotated[ServiceContainer, Depends(get_services)]

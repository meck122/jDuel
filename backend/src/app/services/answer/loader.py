"""Model loading utilities for AnswerService.

Separates the heavy model loading from service logic for cleaner startup.
"""

import logging

from app.services.answer.answer_service import AnswerService

logger = logging.getLogger(__name__)


def load_answer_service() -> AnswerService:
    """Load and initialize the AnswerService with all required models.

    This function handles the slow startup loading of NLP models.
    Should be called once during application startup.

    Returns:
        Fully initialized AnswerService ready for use
    """
    logger.info("Loading AnswerService models (this may take a moment)...")
    service = AnswerService()
    logger.info("AnswerService ready!")
    return service

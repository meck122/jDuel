"""Service for managing game timers."""

import asyncio
import logging
from collections.abc import Awaitable, Callable

logger = logging.getLogger(__name__)


class TimerService:
    """Manages all game timers with proper lifecycle handling.

    Note: Each room can have one timer of each type (question, results, game_over)
    active at a time. Multiple timer types allow for clear separation of concerns
    and easier debugging.
    """

    def __init__(self):
        self._question_timers: dict[str, asyncio.Task] = {}
        self._result_timers: dict[str, asyncio.Task] = {}
        self._game_over_timers: dict[str, asyncio.Task] = {}

    def start_question_timer(
        self,
        room_id: str,
        duration_ms: int,
        callback: Callable[[], Awaitable[None]],
    ) -> None:
        """Start a timer for a question.

        Args:
            room_id: The room ID
            duration_ms: Timer duration in milliseconds
            callback: Async function to call when timer expires
        """
        self._cancel_timer(self._question_timers, room_id)
        task = asyncio.create_task(self._run_timer(duration_ms, callback))
        self._question_timers[room_id] = task

    def start_results_timer(
        self,
        room_id: str,
        duration_ms: int,
        callback: Callable[[], Awaitable[None]],
    ) -> None:
        """Start a timer for results display.

        Args:
            room_id: The room ID
            duration_ms: Timer duration in milliseconds
            callback: Async function to call when timer expires
        """
        self._cancel_timer(self._result_timers, room_id)
        task = asyncio.create_task(self._run_timer(duration_ms, callback))
        self._result_timers[room_id] = task

    def start_game_over_timer(
        self,
        room_id: str,
        duration_ms: int,
        callback: Callable[[], Awaitable[None]],
    ) -> None:
        """Start a timer for game over cleanup.

        Args:
            room_id: The room ID
            duration_ms: Timer duration in milliseconds
            callback: Async function to call when timer expires
        """
        self._cancel_timer(self._game_over_timers, room_id)
        task = asyncio.create_task(self._run_timer(duration_ms, callback))
        self._game_over_timers[room_id] = task

    def cancel_all_timers_for_room(self, room_id: str) -> None:
        """Cancel all timers for a room.

        Args:
            room_id: The room ID
        """
        self._cancel_timer(self._question_timers, room_id)
        self._cancel_timer(self._result_timers, room_id)
        self._cancel_timer(self._game_over_timers, room_id)

    async def _run_timer(
        self,
        duration_ms: int,
        callback: Callable[[], Awaitable[None]],
    ) -> None:
        """Internal timer execution.

        Args:
            duration_ms: Timer duration in milliseconds
            callback: Async function to call when timer expires
        """
        try:
            await asyncio.sleep(duration_ms / 1000)
            await callback()
        except asyncio.CancelledError:
            logger.debug("Timer cancelled")

    def _cancel_timer(self, timer_dict: dict[str, asyncio.Task], room_id: str) -> None:
        """Cancel a specific timer.

        Args:
            timer_dict: The dictionary storing timers
            room_id: The room ID
        """
        if room_id in timer_dict:
            timer_dict[room_id].cancel()
            del timer_dict[room_id]

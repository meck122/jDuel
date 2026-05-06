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
        # Speed Battle timers
        self._match_timers: dict[str, asyncio.Task] = {}
        self._player_cooldowns: dict[tuple[str, str], asyncio.Task] = {}

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

    def start_match_timer(
        self,
        room_id: str,
        duration_ms: int,
        callback: Callable[[], Awaitable[None]],
    ) -> None:
        """Start a Speed Battle match timer for a room.

        Args:
            room_id: The room ID
            duration_ms: Timer duration in milliseconds
            callback: Async function to call when the match timer expires
        """
        self._cancel_match_timer(room_id)
        task = asyncio.create_task(self._run_timer(duration_ms, callback))
        self._match_timers[room_id] = task

    def start_player_cooldown(
        self,
        room_id: str,
        player_id: str,
        duration_ms: int,
        callback: Callable[[], Awaitable[None]],
    ) -> None:
        """Start a per-player wrong-answer cooldown timer.

        Replaces any existing cooldown for the same (room_id, player_id).

        Args:
            room_id: The room ID
            player_id: The player ID
            duration_ms: Cooldown duration in milliseconds
            callback: Async function to call when cooldown expires
        """
        key = (room_id, player_id)
        if key in self._player_cooldowns:
            self._player_cooldowns[key].cancel()
            del self._player_cooldowns[key]
        task = asyncio.create_task(self._run_timer(duration_ms, callback))
        self._player_cooldowns[key] = task

    def cancel_player_cooldown(self, room_id: str, player_id: str) -> None:
        """Cancel a specific player's cooldown timer.

        Args:
            room_id: The room ID
            player_id: The player ID
        """
        key = (room_id, player_id)
        if key in self._player_cooldowns:
            self._player_cooldowns[key].cancel()
            del self._player_cooldowns[key]

    def cancel_all_timers_for_room(self, room_id: str) -> None:
        """Cancel all timers for a room.

        Args:
            room_id: The room ID
        """
        self._cancel_timer(self._question_timers, room_id)
        self._cancel_timer(self._result_timers, room_id)
        self._cancel_timer(self._game_over_timers, room_id)
        self._cancel_match_timer(room_id)
        self._cancel_all_player_cooldowns_for_room(room_id)

    def _cancel_match_timer(self, room_id: str) -> None:
        # No-self-cancel guard: if the match timer's own callback is the
        # currently-running task (e.g. _on_match_end calling
        # cancel_all_timers_for_room), do not cancel ourselves — that would
        # raise CancelledError at the next await checkpoint and abort the
        # callback's remaining work.
        task = self._match_timers.get(room_id)
        if task is None:
            return
        try:
            current = asyncio.current_task()
        except RuntimeError:
            current = None
        if task is current:
            del self._match_timers[room_id]
            return
        self._cancel_timer(self._match_timers, room_id)

    def cancel_all_player_cooldowns_for_room(self, room_id: str) -> None:
        """Cancel every per-player cooldown timer registered for a room."""
        self._cancel_all_player_cooldowns_for_room(room_id)

    def _cancel_all_player_cooldowns_for_room(self, room_id: str) -> None:
        keys_to_cancel = [k for k in self._player_cooldowns if k[0] == room_id]
        for key in keys_to_cancel:
            self._player_cooldowns[key].cancel()
            del self._player_cooldowns[key]

    def _cancel_timer(self, timer_dict: dict[str, asyncio.Task], room_id: str) -> None:
        """Cancel a specific timer.

        Args:
            timer_dict: The dictionary storing timers
            room_id: The room ID
        """
        if room_id in timer_dict:
            timer_dict[room_id].cancel()
            del timer_dict[room_id]

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
        except asyncio.CancelledError:
            logger.debug("Timer cancelled")
            return
        try:
            await callback()
        except asyncio.CancelledError:
            logger.debug("Timer cancelled during callback")
            raise
        except Exception:
            # Surface callback failures instead of swallowing them silently —
            # a silent failure can permanently strand a room (e.g., stuck in
            # PLAYING) with no log line for diagnosis.
            logger.exception("timer callback failed")

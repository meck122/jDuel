"""Tests for TimerService (async)."""

import asyncio

from app.services.core.timer_service import TimerService


class TestTimerService:
    """Test suite for TimerService."""

    async def test_question_timer_fires_callback(self, timer_service: TimerService):
        """Question timer calls callback after duration expires."""
        called = []

        async def callback():
            called.append(True)

        timer_service.start_question_timer("ROOM1", 50, callback)
        await asyncio.sleep(0.1)

        assert len(called) == 1

    async def test_cancel_prevents_callback(self, timer_service: TimerService):
        """Canceling a timer before it fires prevents the callback."""
        called = []

        async def callback():
            called.append(True)

        timer_service.start_question_timer("ROOM1", 200, callback)
        timer_service.cancel_all_timers_for_room("ROOM1")
        await asyncio.sleep(0.3)

        assert len(called) == 0

    async def test_results_timer_fires_callback(self, timer_service: TimerService):
        """Results timer calls callback after duration expires."""
        called = []

        async def callback():
            called.append(True)

        timer_service.start_results_timer("ROOM1", 50, callback)
        await asyncio.sleep(0.1)

        assert len(called) == 1

    async def test_game_over_timer_fires_callback(self, timer_service: TimerService):
        """Game over timer calls callback after duration expires."""
        called = []

        async def callback():
            called.append(True)

        timer_service.start_game_over_timer("ROOM1", 50, callback)
        await asyncio.sleep(0.1)

        assert len(called) == 1

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

    # --- Speed Battle: match timer ---

    async def test_match_timer_fires_callback(self, timer_service: TimerService):
        """Match timer calls callback after duration expires."""
        called = []

        async def callback():
            called.append(True)

        timer_service.start_match_timer("ROOM1", 50, callback)
        await asyncio.sleep(0.1)

        assert len(called) == 1

    async def test_match_timer_replace_cancels_previous(
        self, timer_service: TimerService
    ):
        """Starting a second match timer for the same room cancels the first."""
        calls = []

        async def cb1():
            calls.append("cb1")

        async def cb2():
            calls.append("cb2")

        timer_service.start_match_timer("ROOM1", 200, cb1)
        timer_service.start_match_timer("ROOM1", 50, cb2)
        await asyncio.sleep(0.1)

        assert calls == ["cb2"]

    async def test_match_timer_room_isolation(self, timer_service: TimerService):
        """Cancelling ROOM1's match timer does not affect ROOM2's."""
        calls = []

        async def cb1():
            calls.append("cb1")

        async def cb2():
            calls.append("cb2")

        timer_service.start_match_timer("ROOM1", 50, cb1)
        timer_service.start_match_timer("ROOM2", 50, cb2)
        timer_service.cancel_all_timers_for_room("ROOM1")
        await asyncio.sleep(0.1)

        assert "cb1" not in calls
        assert "cb2" in calls

    # --- Speed Battle: player cooldown timers ---

    async def test_player_cooldown_fires_callback(self, timer_service: TimerService):
        """Player cooldown timer calls callback after duration expires."""
        called = []

        async def callback():
            called.append(True)

        timer_service.start_player_cooldown("ROOM1", "Alice", 50, callback)
        await asyncio.sleep(0.1)

        assert len(called) == 1

    async def test_multiple_players_concurrent_cooldowns(
        self, timer_service: TimerService
    ):
        """Multiple players can have independent concurrent cooldowns."""
        calls = []

        async def cb_alice():
            calls.append("alice")

        async def cb_bob():
            calls.append("bob")

        timer_service.start_player_cooldown("ROOM1", "Alice", 50, cb_alice)
        timer_service.start_player_cooldown("ROOM1", "Bob", 80, cb_bob)
        await asyncio.sleep(0.12)

        assert "alice" in calls
        assert "bob" in calls

    async def test_player_cooldown_replace_cancels_previous(
        self, timer_service: TimerService
    ):
        """Starting a new cooldown for same player cancels the old one."""
        calls = []

        async def cb1():
            calls.append("cb1")

        async def cb2():
            calls.append("cb2")

        timer_service.start_player_cooldown("ROOM1", "Alice", 200, cb1)
        timer_service.start_player_cooldown("ROOM1", "Alice", 50, cb2)
        await asyncio.sleep(0.1)

        assert "cb1" not in calls
        assert "cb2" in calls

    async def test_cancel_player_cooldown_specific(self, timer_service: TimerService):
        """cancel_player_cooldown cancels only the named player, not others."""
        calls = []

        async def cb_alice():
            calls.append("alice")

        async def cb_bob():
            calls.append("bob")

        timer_service.start_player_cooldown("ROOM1", "Alice", 200, cb_alice)
        timer_service.start_player_cooldown("ROOM1", "Bob", 50, cb_bob)
        timer_service.cancel_player_cooldown("ROOM1", "Alice")
        await asyncio.sleep(0.1)

        assert "alice" not in calls
        assert "bob" in calls

    # --- Integration: cancel_all_timers_for_room covers Speed Battle timers ---

    async def test_cancel_all_clears_match_and_cooldowns(
        self, timer_service: TimerService
    ):
        """cancel_all_timers_for_room cancels match timer and all player cooldowns (R11b)."""
        calls = []

        async def cb_match():
            calls.append("match")

        async def cb_alice():
            calls.append("alice")

        async def cb_bob():
            calls.append("bob")

        timer_service.start_match_timer("ROOM1", 200, cb_match)
        timer_service.start_player_cooldown("ROOM1", "Alice", 200, cb_alice)
        timer_service.start_player_cooldown("ROOM1", "Bob", 200, cb_bob)
        timer_service.cancel_all_timers_for_room("ROOM1")
        await asyncio.sleep(0.3)

        assert calls == []

    async def test_cancel_all_covers_classic_and_speed_battle(
        self, timer_service: TimerService
    ):
        """cancel_all_timers_for_room cancels Classic timers and Speed Battle timers together."""
        calls = []

        async def cb_q():
            calls.append("question")

        async def cb_match():
            calls.append("match")

        timer_service.start_question_timer("ROOM1", 50, cb_q)
        timer_service.start_match_timer("ROOM1", 50, cb_match)
        timer_service.cancel_all_timers_for_room("ROOM1")
        await asyncio.sleep(0.1)

        assert calls == []

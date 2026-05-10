"""Tests for SpeedBattleHandler."""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from prometheus_client import REGISTRY

import app.config.game as game_config
import app.services.orchestration.speed_battle_handler as sbh_module
from app.models import GameStatus
from app.services.core.room_manager import RoomManager
from app.services.core.timer_service import TimerService
from app.services.orchestration.speed_battle_handler import (
    PlayerProgress,
    SpeedBattleHandler,
    SpeedBattleRoundState,
)
from app.services.orchestration.state_builder import StateBuilder

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _patch(monkeypatch, name: str, value) -> None:
    """Patch a Speed Battle constant in both game_config and the handler module."""
    monkeypatch.setattr(game_config, name, value)
    monkeypatch.setattr(sbh_module, name, value)


def _setup_room(room_manager: RoomManager, player_ids: list[str]):
    """Create a room and register players, return room."""
    room = room_manager.create_room()
    for pid in player_ids:
        room_manager.register_player(room.room_id, pid)
    room_manager.load_questions_by_difficulty(room.room_id, 1, 5, count=10)
    return room


def _attach_mock_ws(room_manager: RoomManager, room, player_id: str):
    ws = MagicMock()
    ws.send_json = AsyncMock()
    room_manager.attach_connection(room.room_id, player_id, ws)
    return ws


# ---------------------------------------------------------------------------
# Match start
# ---------------------------------------------------------------------------


class TestMatchStart:
    async def test_start_match_initialises_round_state(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """start_match creates PlayerProgress for each player and zeros scores."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        room = _setup_room(room_manager, ["Alice", "Bob"])

        async with room.lock:
            await speed_battle_handler.start_match(room)

        round_state = speed_battle_handler._round_states[room.room_id]
        assert "Alice" in round_state.per_player
        assert "Bob" in round_state.per_player
        assert round_state.per_player["Alice"].correct_count == 0
        assert room.scores == {"Alice": 0, "Bob": 0}

    async def test_start_match_schedules_match_timer(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        timer_service: TimerService,
        monkeypatch,
    ):
        """start_match schedules a match timer that fires _on_match_end."""
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 100)
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)

        await asyncio.sleep(0.15)

        # Match timer should have fired → room.status == FINISHED
        assert room.status == GameStatus.FINISHED

    async def test_start_match_raises_without_orchestrator(
        self,
        room_manager: RoomManager,
        timer_service: TimerService,
        state_builder: StateBuilder,
        mock_room_closer,
    ):
        """start_match raises RuntimeError if set_orchestrator was never called."""
        handler = SpeedBattleHandler(
            room_manager=room_manager,
            timer_service=timer_service,
            state_builder=state_builder,
            room_closer=mock_room_closer,
        )
        room = _setup_room(room_manager, ["Alice"])
        with pytest.raises(RuntimeError, match="not bound to orchestrator"):
            async with room.lock:
                await handler.start_match(room)

    async def test_fresh_allocation_on_play_again(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """start_match allocates a fresh SpeedBattleRoundState on each call (not in-place)."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])

        async with room.lock:
            await speed_battle_handler.start_match(room)
        state1 = speed_battle_handler._round_states[room.room_id]

        speed_battle_handler.cleanup_room(room.room_id)

        async with room.lock:
            await speed_battle_handler.start_match(room)
        state2 = speed_battle_handler._round_states[room.room_id]

        assert state1 is not state2


# ---------------------------------------------------------------------------
# Happy answer flow
# ---------------------------------------------------------------------------


class TestAnswerFlow:
    async def test_correct_answer_advances_index_and_score(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Correct answer advances current_question_index and mirrors room.scores."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        q0_answer = room.questions[0].answer
        await speed_battle_handler.handle_answer(room, "Alice", q0_answer, 0)

        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        assert progress.current_question_index == 1
        assert progress.correct_count == 1
        assert room.scores["Alice"] == 1

    async def test_five_correct_answers_advance_five_steps(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Sequence of 5 correct answers advances player 5 steps."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 10)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        for i in range(5):
            await speed_battle_handler.handle_answer(
                room, "Alice", room.questions[i].answer, i
            )

        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        assert progress.current_question_index == 5
        assert progress.correct_count == 5
        assert room.scores["Alice"] == 5

    async def test_wrong_answer_sets_cooldown_and_advances_after(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Wrong answer sets cooldown; after cooldown fires player advances."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        _patch(monkeypatch, "SPEED_BATTLE_WRONG_COOLDOWN_MS", 80)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        await speed_battle_handler.handle_answer(room, "Alice", "WRONG_ANSWER", 0)

        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        assert progress.wrong_count == 1
        assert progress.cooldown_expires_at_monotonic is not None
        assert progress.revealed_correct_answer == room.questions[0].answer
        assert progress.current_question_index == 0  # not advanced yet

        # Wait for cooldown to fire
        await asyncio.sleep(0.15)

        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        assert progress.current_question_index == 1  # advanced by cooldown callback
        assert progress.cooldown_expires_at_monotonic is None
        assert progress.revealed_correct_answer is None


# ---------------------------------------------------------------------------
# R30 idempotency drops
# ---------------------------------------------------------------------------


class TestIdempotencyDrops:
    async def _start(self, handler, room_manager, room, monkeypatch):
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        _patch(monkeypatch, "SPEED_BATTLE_WRONG_COOLDOWN_MS", 60_000)
        _attach_mock_ws(room_manager, room, "Alice")
        async with room.lock:
            await handler.start_match(room)
        room.status = GameStatus.PLAYING

    async def test_drop_when_in_cooldown(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        room = _setup_room(room_manager, ["Alice"])
        await self._start(speed_battle_handler, room_manager, room, monkeypatch)

        # Trigger cooldown
        await speed_battle_handler.handle_answer(room, "Alice", "WRONG", 0)
        progress_before = speed_battle_handler._round_states[room.room_id].per_player[
            "Alice"
        ]
        idx_before = progress_before.current_question_index

        # Answer during cooldown — should be dropped
        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )

        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        assert progress.current_question_index == idx_before

    async def test_drop_when_exhausted(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        room = _setup_room(room_manager, ["Alice"])
        await self._start(speed_battle_handler, room_manager, room, monkeypatch)
        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        progress.exhausted = True

        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )

        assert progress.correct_count == 0  # no change

    async def test_drop_when_round_ended(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        room = _setup_room(room_manager, ["Alice"])
        await self._start(speed_battle_handler, room_manager, room, monkeypatch)
        speed_battle_handler._round_states[room.room_id].ended = True

        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )

        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        assert progress.correct_count == 0

    async def test_drop_when_stale_question_index(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        room = _setup_room(room_manager, ["Alice"])
        await self._start(speed_battle_handler, room_manager, room, monkeypatch)
        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        progress.current_question_index = 5

        # Send answer with stale index 2
        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[2].answer, 2
        )

        assert progress.correct_count == 0

    async def test_drop_when_question_index_none(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        room = _setup_room(room_manager, ["Alice"])
        await self._start(speed_battle_handler, room_manager, room, monkeypatch)

        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, None
        )

        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        assert progress.correct_count == 0

    async def test_drop_second_answer_for_same_question_after_advance(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Double-send race: second ANSWER with old questionIndex dropped after advance."""
        room = _setup_room(room_manager, ["Alice"])
        await self._start(speed_battle_handler, room_manager, room, monkeypatch)

        # First answer correct → advances to 1
        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )
        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        assert progress.current_question_index == 1

        # Second answer for question 0 (stale) → dropped
        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )
        assert progress.current_question_index == 1
        assert progress.correct_count == 1


# ---------------------------------------------------------------------------
# Match end
# ---------------------------------------------------------------------------


class TestMatchEnd:
    async def test_match_end_sets_finished_status(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """_on_match_end sets room.status = FINISHED and round_state.ended = True."""
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 100)
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        await asyncio.sleep(0.15)

        assert room.status == GameStatus.FINISHED
        assert speed_battle_handler._round_states[room.room_id].ended is True

    async def test_match_end_cancels_in_flight_cooldowns(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        timer_service: TimerService,
        monkeypatch,
    ):
        """R11b: in-flight cooldowns are cancelled when match ends."""
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 80)
        _patch(monkeypatch, "SPEED_BATTLE_WRONG_COOLDOWN_MS", 500)
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        # Trigger a long cooldown
        await speed_battle_handler.handle_answer(room, "Alice", "WRONG", 0)

        progress = speed_battle_handler._round_states[room.room_id].per_player["Alice"]
        idx_at_wrong = progress.current_question_index

        # Wait for match to end (100ms) but not for cooldown (500ms)
        await asyncio.sleep(0.15)

        assert room.status == GameStatus.FINISHED
        # Cooldown was cancelled — player frozen at wrong-answer index
        assert progress.current_question_index == idx_at_wrong

    async def test_compute_leaderboard_correct_placement(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """_compute_leaderboard sorts by correct desc, wrong asc (R17)."""
        now = time.monotonic()
        round_state = SpeedBattleRoundState(
            match_start_monotonic=now,
            match_end_monotonic=now + 180,
            match_start_wall=datetime.now(UTC),
        )
        round_state.per_player["A"] = PlayerProgress(correct_count=10, wrong_count=2)
        round_state.per_player["B"] = PlayerProgress(correct_count=10, wrong_count=3)
        round_state.per_player["C"] = PlayerProgress(correct_count=8, wrong_count=1)

        rows = speed_battle_handler._compute_leaderboard(round_state)
        by_player = {r.playerId: r for r in rows}

        assert by_player["A"].placement == 1
        assert by_player["B"].placement == 2
        assert by_player["C"].placement == 3

    async def test_compute_leaderboard_shared_placement(
        self,
        speed_battle_handler: SpeedBattleHandler,
    ):
        """Tied players share a placement number (R17)."""
        now = time.monotonic()
        round_state = SpeedBattleRoundState(
            match_start_monotonic=now,
            match_end_monotonic=now + 180,
            match_start_wall=datetime.now(UTC),
        )
        round_state.per_player["A"] = PlayerProgress(correct_count=5, wrong_count=2)
        round_state.per_player["B"] = PlayerProgress(correct_count=5, wrong_count=2)
        round_state.per_player["C"] = PlayerProgress(correct_count=3, wrong_count=0)

        rows = speed_battle_handler._compute_leaderboard(round_state)
        by_player = {r.playerId: r for r in rows}

        assert by_player["A"].placement == 1
        assert by_player["B"].placement == 1
        assert by_player["C"].placement == 3

    async def test_match_end_fallback_on_game_over_timer_exception(
        self,
        room_manager: RoomManager,
        timer_service: TimerService,
        state_builder: StateBuilder,
        mock_room_closer,
        monkeypatch,
    ):
        """If start_game_over_timer raises, _on_match_end falls back to close_room."""
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 80)
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)

        bad_orchestrator = MagicMock()
        bad_orchestrator.start_game_over_timer = MagicMock(
            side_effect=RuntimeError("boom")
        )
        mock_room_closer.close_room = AsyncMock()

        handler = SpeedBattleHandler(
            room_manager=room_manager,
            timer_service=timer_service,
            state_builder=state_builder,
            room_closer=mock_room_closer,
        )
        handler.set_orchestrator(bad_orchestrator)

        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")
        async with room.lock:
            await handler.start_match(room)
        room.status = GameStatus.PLAYING

        await asyncio.sleep(0.15)

        mock_room_closer.close_room.assert_called_once()


# ---------------------------------------------------------------------------
# Reconnect (R21)
# ---------------------------------------------------------------------------


class TestReconnect:
    async def test_handle_connect_sends_per_recipient_snapshot(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """handle_connect sends a single snapshot to the reconnecting player only."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice", "Bob"])
        ws_alice = _attach_mock_ws(room_manager, room, "Alice")
        ws_bob = _attach_mock_ws(room_manager, room, "Bob")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        ws_alice.send_json.reset_mock()
        ws_bob.send_json.reset_mock()

        await speed_battle_handler.handle_connect(room, "Alice")

        ws_alice.send_json.assert_called_once()  # Alice received snapshot
        ws_bob.send_json.assert_not_called()  # Bob did NOT receive anything

    async def test_handle_connect_no_round_state_is_noop(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
    ):
        """handle_connect with no round state is a silent no-op."""
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")
        # No start_match called
        await speed_battle_handler.handle_connect(room, "Alice")  # must not raise

    async def test_handle_connect_after_match_end_sends_finished_state(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Reconnect after match end sends FINISHED per-recipient state."""
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 80)
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        room = _setup_room(room_manager, ["Alice"])
        ws_alice = _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        await asyncio.sleep(0.15)  # let match end
        assert room.status == GameStatus.FINISHED

        ws_alice.send_json.reset_mock()
        await speed_battle_handler.handle_connect(room, "Alice")

        ws_alice.send_json.assert_called_once()
        payload = ws_alice.send_json.call_args[0][0]
        assert payload["roomState"]["status"] == "finished"
        # Finding 7: FINISHED broadcast carries matchRemainingMs == 0
        assert payload["roomState"]["speedBattle"]["matchRemainingMs"] == 0


# ---------------------------------------------------------------------------
# Per-recipient broadcast (R29 privacy)
# ---------------------------------------------------------------------------


class TestPerRecipientBroadcast:
    async def test_each_player_receives_own_question(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """After Alice answers, broadcast sends Alice question N+1 and Bob question 0."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 10)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice", "Bob"])
        ws_alice = _attach_mock_ws(room_manager, room, "Alice")
        ws_bob = _attach_mock_ws(room_manager, room, "Bob")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        ws_alice.send_json.reset_mock()
        ws_bob.send_json.reset_mock()

        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )

        alice_payload = ws_alice.send_json.call_args[0][0]
        bob_payload = ws_bob.send_json.call_args[0][0]

        # Alice is on question 1; Bob is still on question 0
        alice_sb = alice_payload["roomState"]["speedBattle"]
        bob_sb = bob_payload["roomState"]["speedBattle"]
        assert alice_sb["playerState"]["questionIndex"] == 1
        assert bob_sb["playerState"]["questionIndex"] == 0

    async def test_cooldown_state_private_to_player(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Bob's cooldown state does not appear in Alice's payload."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        _patch(monkeypatch, "SPEED_BATTLE_WRONG_COOLDOWN_MS", 60_000)
        room = _setup_room(room_manager, ["Alice", "Bob"])
        ws_alice = _attach_mock_ws(room_manager, room, "Alice")
        ws_bob = _attach_mock_ws(room_manager, room, "Bob")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        ws_alice.send_json.reset_mock()
        ws_bob.send_json.reset_mock()

        await speed_battle_handler.handle_answer(room, "Bob", "WRONG", 0)

        alice_payload = ws_alice.send_json.call_args[0][0]
        bob_payload = ws_bob.send_json.call_args[0][0]

        alice_sb = alice_payload["roomState"]["speedBattle"]
        bob_sb = bob_payload["roomState"]["speedBattle"]

        # Bob's payload has cooldown fields
        assert "cooldownRemainingMs" in bob_sb["playerState"]
        assert "cooldownCorrectAnswer" in bob_sb["playerState"]
        # Alice's payload does NOT
        assert "cooldownRemainingMs" not in alice_sb["playerState"]
        assert "cooldownCorrectAnswer" not in alice_sb["playerState"]

    async def test_room_scores_invariant_after_answers(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """room.scores[pid] == per_player[pid].correct_count after every ANSWER."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 10)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice", "Bob"])
        _attach_mock_ws(room_manager, room, "Alice")
        _attach_mock_ws(room_manager, room, "Bob")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        for i in range(3):
            await speed_battle_handler.handle_answer(
                room, "Alice", room.questions[i].answer, i
            )
            rs = speed_battle_handler._round_states[room.room_id]
            for pid in room.players:
                assert room.scores[pid] == rs.per_player[pid].correct_count


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------


class TestCleanup:
    def test_cleanup_room_removes_round_state(
        self,
        speed_battle_handler: SpeedBattleHandler,
    ):
        """cleanup_room removes the round state entry."""
        now = time.monotonic()
        speed_battle_handler._round_states["ROOM1"] = SpeedBattleRoundState(
            match_start_monotonic=now,
            match_end_monotonic=now + 180,
            match_start_wall=datetime.now(UTC),
        )
        speed_battle_handler.cleanup_room("ROOM1")
        assert "ROOM1" not in speed_battle_handler._round_states

    def test_cleanup_room_nonexistent_is_noop(
        self,
        speed_battle_handler: SpeedBattleHandler,
    ):
        """cleanup_room on an unknown room does not raise."""
        speed_battle_handler.cleanup_room("UNKNOWN")  # must not raise

    async def test_handle_answer_after_cleanup_is_silent_noop(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """handle_answer after cleanup_room is a silent no-op."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        speed_battle_handler.cleanup_room(room.room_id)

        # Must not raise
        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )


# ---------------------------------------------------------------------------
# Review-fixer regression tests (PR review findings 1, 2, 4, 6)
# ---------------------------------------------------------------------------


def _all_mc_questions() -> list:
    """Question pool where every question has wrong_answers (for MC tests)."""
    from app.models import Question

    return [
        Question(
            text=f"Q{i}",
            answer=f"correct_{i}",
            category="Test",
            wrong_answers=(f"w{i}_a", f"w{i}_b", f"w{i}_c"),
        )
        for i in range(10)
    ]


def _setup_mc_room(room_manager: RoomManager, player_ids: list[str]):
    """Like _setup_room but ensures every question has wrong_answers."""
    from app.services.core.question_provider import StaticQuestionProvider

    room_manager._question_provider = StaticQuestionProvider(_all_mc_questions())
    room = room_manager.create_room()
    for pid in player_ids:
        room_manager.register_player(room.room_id, pid)
    room_manager.load_questions_by_difficulty(room.room_id, 1, 5, count=10)
    return room


class TestOptionsStableAcrossBroadcasts:
    """Finding 1: per-recipient broadcasts must not reshuffle MC options."""

    async def test_options_stable_across_peer_answer_broadcast(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Alice's options for Q5 stay identical when Bob answers and triggers a broadcast."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 10)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_mc_room(room_manager, ["Alice", "Bob"])
        room.config.multiple_choice_enabled = True
        ws_alice = _attach_mock_ws(room_manager, room, "Alice")
        _attach_mock_ws(room_manager, room, "Bob")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        # Park Alice on Q5
        speed_battle_handler._round_states[room.room_id].per_player[
            "Alice"
        ].current_question_index = 5

        # Bob answers Q0 correctly → triggers per-recipient broadcast (Alice receives one)
        ws_alice.send_json.reset_mock()
        await speed_battle_handler.handle_answer(
            room, "Bob", room.questions[0].answer, 0
        )
        first_payload = ws_alice.send_json.call_args[0][0]
        first_options = first_payload["roomState"]["currentQuestion"]["options"]

        # Bob answers Q1 correctly → another broadcast
        ws_alice.send_json.reset_mock()
        await speed_battle_handler.handle_answer(
            room, "Bob", room.questions[1].answer, 1
        )
        second_payload = ws_alice.send_json.call_args[0][0]
        second_options = second_payload["roomState"]["currentQuestion"]["options"]

        assert first_options is not None
        assert second_options is not None
        assert first_options == second_options


class TestMatchEndUnderRealTimer:
    """Finding 2: _on_match_end must complete its broadcast + start_game_over_timer
    even when invoked as the match timer's own callback (no self-cancel)."""

    async def test_match_end_via_real_timer_starts_game_over(
        self,
        room_manager: RoomManager,
        timer_service: TimerService,
        state_builder: StateBuilder,
        mock_room_closer,
        mock_orchestrator_timer,
        monkeypatch,
    ):
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 50)
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)

        handler = SpeedBattleHandler(
            room_manager=room_manager,
            timer_service=timer_service,
            state_builder=state_builder,
            room_closer=mock_room_closer,
        )
        handler.set_orchestrator(mock_orchestrator_timer)

        room = _setup_room(room_manager, ["Alice"])
        ws_alice = _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await handler.start_match(room)
        room.status = GameStatus.PLAYING

        # Allow the match timer to fire naturally
        await asyncio.sleep(0.20)

        # FINISHED broadcast was emitted
        assert ws_alice.send_json.called
        last_payload = ws_alice.send_json.call_args[0][0]
        assert last_payload["roomState"]["status"] == "finished"
        # And start_game_over_timer was scheduled — was NOT aborted by self-cancel
        mock_orchestrator_timer.start_game_over_timer.assert_called_once_with(
            room.room_id
        )


class TestAnswerAfterDeadline:
    """Finding 4: ANSWER arriving past match_end_monotonic must be dropped."""

    async def test_answer_after_match_deadline_dropped(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])
        ws_alice = _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        round_state = speed_battle_handler._round_states[room.room_id]
        deadline_plus = round_state.match_end_monotonic + 0.001

        ws_alice.send_json.reset_mock()
        # Force time.monotonic to return T = deadline + 1ms
        monkeypatch.setattr(sbh_module.time, "monotonic", lambda: deadline_plus)

        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )

        progress = round_state.per_player["Alice"]
        assert progress.correct_count == 0
        assert room.scores["Alice"] == 0
        ws_alice.send_json.assert_not_called()


class TestPerRecipientBroadcastSnapshotsScores:
    """Finding 6: scores mutated between sends must not leak into later recipients."""

    async def test_scores_frozen_per_broadcast(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 10)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice", "Bob", "Carol"])

        # Build fake WebSockets where Bob's send_json mutates room.scores between
        # the first and subsequent sends. We assert every recipient sees the
        # same "players" dict regardless of mutation.
        seen: dict[str, dict] = {}

        def make_ws(pid: str):
            ws = MagicMock()

            async def send_json(payload, _pid=pid):
                seen[_pid] = payload["roomState"]["players"]
                # Mutate room.scores AFTER each send to simulate a concurrent
                # task acquiring the lock between iterations of broadcast.
                room.scores["Carol"] = room.scores.get("Carol", 0) + 100

            ws.send_json = AsyncMock(side_effect=send_json)
            room_manager.attach_connection(room.room_id, pid, ws)
            return ws

        make_ws("Alice")
        make_ws("Bob")
        make_ws("Carol")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        # Trigger a single per-recipient broadcast via Alice's correct answer
        await speed_battle_handler.handle_answer(
            room, "Alice", room.questions[0].answer, 0
        )

        assert set(seen.keys()) == {"Alice", "Bob", "Carol"}
        # All three recipients must have observed identical "players" snapshots
        # even though the mock send_json mutated room.scores between calls.
        first = seen["Alice"]
        for pid in ("Bob", "Carol"):
            assert seen[pid] == first, (
                f"Recipient {pid} saw different scores than Alice — "
                f"per-recipient closure is not snapshotting under lock"
            )


class TestCooldownEndRevalidatesRoom:
    """Finding 8: _on_cooldown_end must be a no-op if room dropped before lock."""

    async def test_cooldown_after_room_deleted_is_noop(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        _patch(monkeypatch, "SPEED_BATTLE_WRONG_COOLDOWN_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")

        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING
        room_id = room.room_id

        # Simulate the room being torn down before _on_cooldown_end runs.
        room_manager._repository.delete(room_id)

        # Direct invocation of the callback — must not raise and must not mutate.
        await speed_battle_handler._on_cooldown_end(room_id, "Alice")


class TestTimerCallbackExceptionLogged:
    """Finding 3: callback exceptions must be logged, not swallowed silently."""

    async def test_callback_exception_is_logged(
        self,
        timer_service: TimerService,
        caplog,
    ):
        async def boom():
            raise RuntimeError("boom")

        import logging as _logging

        caplog.set_level(_logging.ERROR, logger="app.services.core.timer_service")
        timer_service.start_question_timer("ROOMX", 10, boom)
        await asyncio.sleep(0.05)

        assert any(
            "timer callback failed" in rec.message for rec in caplog.records
        ), f"expected log entry; got: {[rec.message for rec in caplog.records]}"


class TestMatchEndFallbackUnderLock:
    """Finding 5: fallback close_room runs under room.lock."""

    async def test_fallback_close_room_acquires_lock(
        self,
        room_manager: RoomManager,
        timer_service: TimerService,
        state_builder: StateBuilder,
        mock_room_closer,
        monkeypatch,
    ):
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)

        bad_orchestrator = MagicMock()
        bad_orchestrator.start_game_over_timer = MagicMock(
            side_effect=RuntimeError("boom")
        )

        lock_held_during_close: list[bool] = []

        async def recording_close(room_id):
            r = room_manager.get_room(room_id)
            lock_held_during_close.append(r.lock.locked() if r else False)

        mock_room_closer.close_room = AsyncMock(side_effect=recording_close)

        handler = SpeedBattleHandler(
            room_manager=room_manager,
            timer_service=timer_service,
            state_builder=state_builder,
            room_closer=mock_room_closer,
        )
        handler.set_orchestrator(bad_orchestrator)

        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")
        async with room.lock:
            await handler.start_match(room)
        room.status = GameStatus.PLAYING

        await handler._on_match_end(room.room_id)

        mock_room_closer.close_room.assert_called_once()
        assert lock_held_during_close == [True]


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def _counter_value(name: str) -> float:
    """Return current value of a prometheus counter (0.0 if never incremented)."""
    return REGISTRY.get_sample_value(name + "_total") or 0.0


def _histogram_count(name: str) -> float:
    """Return current observation count of a prometheus histogram."""
    return REGISTRY.get_sample_value(name + "_count") or 0.0


class TestMetrics:
    async def test_cooldown_counter_increments_on_wrong_answer(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Wrong answer in handle_answer increments speed_battle_cooldowns_total."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        _patch(monkeypatch, "SPEED_BATTLE_WRONG_COOLDOWN_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")
        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        before = _counter_value("jduel_speed_battle_cooldowns")
        await speed_battle_handler.handle_answer(room, "Alice", "wrong_answer", 0)
        after = _counter_value("jduel_speed_battle_cooldowns")

        assert after - before == 1.0

    async def test_cooldown_counter_not_incremented_on_correct_answer(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """Correct answer does not increment speed_battle_cooldowns_total."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")
        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        correct = room.questions[0].answer
        before = _counter_value("jduel_speed_battle_cooldowns")
        await speed_battle_handler.handle_answer(room, "Alice", correct, 0)
        after = _counter_value("jduel_speed_battle_cooldowns")

        assert after == before

    async def test_match_duration_histogram_observed_on_match_end(
        self,
        speed_battle_handler: SpeedBattleHandler,
        room_manager: RoomManager,
        monkeypatch,
    ):
        """_on_match_end observes a sample in speed_battle_match_duration_seconds."""
        _patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        _patch(monkeypatch, "SPEED_BATTLE_MATCH_TIME_MS", 60_000)
        room = _setup_room(room_manager, ["Alice"])
        _attach_mock_ws(room_manager, room, "Alice")
        async with room.lock:
            await speed_battle_handler.start_match(room)
        room.status = GameStatus.PLAYING

        before = _histogram_count("jduel_speed_battle_match_duration_seconds")
        await speed_battle_handler._on_match_end(room.room_id)
        after = _histogram_count("jduel_speed_battle_match_duration_seconds")

        assert after - before == 1.0

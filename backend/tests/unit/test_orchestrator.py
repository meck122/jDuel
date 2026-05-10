"""Tests for GameOrchestrator."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

from prometheus_client import REGISTRY

from app.models import GameStatus
from app.services.orchestration.orchestrator import GameOrchestrator


class TestOrchestrator:
    """Test suite for GameOrchestrator."""

    async def test_handle_connect_success(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Connecting a registered player returns True and attaches WebSocket."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        mock_ws = MagicMock()
        # Stub send_json to avoid broadcast errors
        mock_ws.send_json = MagicMock(return_value=None)

        result = await orchestrator.handle_connect(room.room_id, "Alice", mock_ws)

        assert result is True
        assert "Alice" in room.connections

    async def test_handle_connect_nonexistent_room(
        self, orchestrator: GameOrchestrator
    ):
        """Connecting to a non-existent room returns False."""
        mock_ws = MagicMock()
        result = await orchestrator.handle_connect("ZZZZ", "Alice", mock_ws)
        assert result is False

    async def test_handle_connect_unregistered_player(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Connecting an unregistered player returns False."""
        room = room_manager.create_room()
        mock_ws = MagicMock()
        result = await orchestrator.handle_connect(room.room_id, "Ghost", mock_ws)
        assert result is False

    async def test_handle_start_game_non_host_rejected(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Non-host cannot start the game; status stays WAITING."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")  # host
        room_manager.register_player(room.room_id, "Bob")

        await orchestrator.handle_start_game(room.room_id, "Bob")

        assert room.status == GameStatus.WAITING

    async def test_handle_start_game_loads_questions_and_starts(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Host starting the game loads questions and transitions to PLAYING."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")  # host
        room.config.game_mode = "classic"
        assert len(room.questions) == 0

        await orchestrator.handle_start_game(room.room_id, "Alice")

        assert len(room.questions) > 0
        assert room.status == GameStatus.PLAYING

    async def test_handle_answer_records_answer(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Submitting an answer records it in the room."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room_manager.register_player(
            room.room_id, "Bob"
        )  # 2 players so single answer won't trigger results
        room.config.game_mode = "classic"

        await orchestrator.handle_start_game(room.room_id, "Alice")
        await orchestrator.handle_answer(room.room_id, "Alice", "4")

        assert "Alice" in room.answered_players
        assert room.player_answers["Alice"] == "4"

    async def test_handle_answer_single_player_transitions_to_results(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Single player answering triggers transition to RESULTS (all_answered)."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "classic"

        await orchestrator.handle_start_game(room.room_id, "Alice")
        await orchestrator.handle_answer(room.room_id, "Alice", "4")

        assert room.status == GameStatus.RESULTS

    async def test_handle_config_update_non_host_rejected(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Non-host config update is rejected; config unchanged."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")  # host
        room_manager.register_player(room.room_id, "Bob")

        await orchestrator.handle_config_update(
            room.room_id, "Bob", {"difficulty": "beast"}
        )

        assert room.config.difficulty == "baby"  # default, unchanged

    async def test_handle_config_update_game_mode_speed_battle(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Host sending gameMode='speed_battle' updates room.config.game_mode."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")  # host

        await orchestrator.handle_config_update(
            room.room_id, "Alice", {"gameMode": "speed_battle"}
        )

        assert room.config.game_mode == "speed_battle"

    async def test_handle_config_update_game_mode_switch_back_to_classic(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Host can switch back from speed_battle to classic."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"

        await orchestrator.handle_config_update(
            room.room_id, "Alice", {"gameMode": "classic"}
        )

        assert room.config.game_mode == "classic"

    async def test_handle_config_update_game_mode_invalid_ignored(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Invalid game mode is silently dropped; game_mode stays at default."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")

        await orchestrator.handle_config_update(
            room.room_id, "Alice", {"gameMode": "garbage"}
        )

        assert room.config.game_mode == "speed_battle"

    async def test_handle_config_update_difficulty_baby(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Host can set difficulty to 'baby'; config updated."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")

        await orchestrator.handle_config_update(
            room.room_id, "Alice", {"difficulty": "baby"}
        )

        assert room.config.difficulty == "baby"

    async def test_handle_config_update_other_field_does_not_affect_game_mode(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """UPDATE_CONFIG with only difficulty leaves game_mode unchanged."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"

        await orchestrator.handle_config_update(
            room.room_id, "Alice", {"difficulty": "beast"}
        )

        assert room.config.game_mode == "speed_battle"
        assert room.config.difficulty == "beast"

    async def test_handle_config_update_game_mode_non_host_rejected(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Non-host cannot change game_mode; remains unchanged."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")  # host
        room_manager.register_player(room.room_id, "Bob")

        await orchestrator.handle_config_update(
            room.room_id, "Bob", {"gameMode": "speed_battle"}
        )

        assert room.config.game_mode == "speed_battle"

    async def test_handle_config_update_game_mode_after_game_start_rejected(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Host cannot change game_mode after game has started."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "classic"
        await orchestrator.handle_start_game(room.room_id, "Alice")

        await orchestrator.handle_config_update(
            room.room_id, "Alice", {"gameMode": "speed_battle"}
        )

        assert room.config.game_mode == "classic"

    async def test_handle_disconnect_last_player_deletes_room(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Last player disconnecting deletes the room."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        mock_ws = MagicMock()
        mock_ws.send_json = MagicMock(return_value=None)
        await orchestrator.handle_connect(room.room_id, "Alice", mock_ws)
        room_id = room.room_id

        await orchestrator.handle_disconnect(room_id, "Alice")

        assert room_manager.get_room(room_id) is None

    # --- Play Again tests ---

    async def _setup_finished_game(self, orchestrator, room_manager):
        """Helper: create room, register host, connect, play to FINISHED."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        mock_ws = MagicMock()
        mock_ws.send_json = MagicMock(return_value=None)
        await orchestrator.handle_connect(room.room_id, "Alice", mock_ws)

        # Start and complete the game
        room.config.game_mode = "classic"
        await orchestrator.handle_start_game(room.room_id, "Alice")
        for i in range(len(room.questions)):
            await orchestrator.handle_answer(
                room.room_id, "Alice", room.questions[i].answer
            )
            # Results timer callback — advance to next question or finish
            await orchestrator._on_results_timeout(room.room_id)

        assert room.status == GameStatus.FINISHED
        return room

    async def test_handle_play_again_resets_to_waiting(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Host play again resets room to WAITING with scores at zero."""
        room = await self._setup_finished_game(orchestrator, room_manager)
        assert room.scores["Alice"] > 0  # Had points from the game

        await orchestrator.handle_play_again(room.room_id, "Alice")

        assert room.status == GameStatus.WAITING
        assert room.scores["Alice"] == 0
        assert room.question_index == 0
        assert room.questions == []

    async def test_handle_play_again_non_host_rejected(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Non-host cannot trigger play again; status stays FINISHED."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")  # host
        room_manager.register_player(room.room_id, "Bob")
        mock_ws_alice = MagicMock()
        mock_ws_alice.send_json = MagicMock(return_value=None)
        mock_ws_bob = MagicMock()
        mock_ws_bob.send_json = MagicMock(return_value=None)
        await orchestrator.handle_connect(room.room_id, "Alice", mock_ws_alice)
        await orchestrator.handle_connect(room.room_id, "Bob", mock_ws_bob)

        # Play to finished
        room.config.game_mode = "classic"
        await orchestrator.handle_start_game(room.room_id, "Alice")
        for i in range(len(room.questions)):
            await orchestrator.handle_answer(
                room.room_id, "Alice", room.questions[i].answer
            )
            await orchestrator.handle_answer(room.room_id, "Bob", "wrong")
            await orchestrator._on_results_timeout(room.room_id)

        assert room.status == GameStatus.FINISHED

        await orchestrator.handle_play_again(room.room_id, "Bob")

        assert room.status == GameStatus.FINISHED  # Unchanged

    async def test_handle_play_again_wrong_state_rejected(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Play again rejected when room is not in FINISHED state."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        mock_ws = MagicMock()
        mock_ws.send_json = MagicMock(return_value=None)
        await orchestrator.handle_connect(room.room_id, "Alice", mock_ws)

        # Room is in WAITING state
        await orchestrator.handle_play_again(room.room_id, "Alice")
        assert room.status == GameStatus.WAITING  # Unchanged, not reset

    async def test_handle_play_again_nonexistent_room(
        self, orchestrator: GameOrchestrator
    ):
        """Play again on nonexistent room does nothing (no crash)."""
        await orchestrator.handle_play_again("ZZZZ", "Alice")  # Should not raise

    async def test_handle_play_again_prunes_disconnected_players(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Disconnected players are removed from room during play again."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")  # host
        room_manager.register_player(room.room_id, "Bob")
        mock_ws_alice = MagicMock()
        mock_ws_alice.send_json = MagicMock(return_value=None)
        mock_ws_bob = MagicMock()
        mock_ws_bob.send_json = MagicMock(return_value=None)
        await orchestrator.handle_connect(room.room_id, "Alice", mock_ws_alice)
        await orchestrator.handle_connect(room.room_id, "Bob", mock_ws_bob)

        # Play to finished
        room.config.game_mode = "classic"
        await orchestrator.handle_start_game(room.room_id, "Alice")
        for i in range(len(room.questions)):
            await orchestrator.handle_answer(
                room.room_id, "Alice", room.questions[i].answer
            )
            await orchestrator.handle_answer(room.room_id, "Bob", "wrong")
            await orchestrator._on_results_timeout(room.room_id)

        assert room.status == GameStatus.FINISHED

        # Bob disconnects
        await orchestrator.handle_disconnect(room.room_id, "Bob")
        assert "Bob" not in room.connections
        assert "Bob" in room.players  # Still registered

        # Host triggers play again
        await orchestrator.handle_play_again(room.room_id, "Alice")

        assert room.status == GameStatus.WAITING
        assert "Bob" not in room.players  # Pruned
        assert "Bob" not in room.scores  # Pruned
        assert "Alice" in room.players  # Still here
        assert room.scores["Alice"] == 0  # Score reset

    async def test_handle_play_again_then_start_game_cycle(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Full cycle: finish game → play again → start new game successfully."""
        room = await self._setup_finished_game(orchestrator, room_manager)

        # Play again
        await orchestrator.handle_play_again(room.room_id, "Alice")
        assert room.status == GameStatus.WAITING

        # Start a new game — should work (questions loaded fresh)
        await orchestrator.handle_start_game(room.room_id, "Alice")
        assert room.status == GameStatus.PLAYING
        assert len(room.questions) > 0
        assert room.question_index == 0

    # --- Concurrency / lock tests ---

    async def test_concurrent_answers_no_double_scoring(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Two players answering simultaneously should not corrupt state."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room_manager.register_player(room.room_id, "Bob")
        room.config.game_mode = "classic"

        await orchestrator.handle_start_game(room.room_id, "Alice")
        correct_answer = room.questions[0].answer

        # Submit both answers concurrently
        await asyncio.gather(
            orchestrator.handle_answer(room.room_id, "Alice", correct_answer),
            orchestrator.handle_answer(room.room_id, "Bob", correct_answer),
        )

        # Both answers recorded, no duplication
        assert "Alice" in room.answered_players
        assert "Bob" in room.answered_players
        assert room.scores["Alice"] > 0
        assert room.scores["Bob"] > 0
        # First gets 1000, second gets 500 — total is 1500
        assert room.scores["Alice"] + room.scores["Bob"] == 1500
        # All answered → transitioned to results exactly once
        assert room.status == GameStatus.RESULTS

    async def test_timer_fires_during_answer_processing(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Timer callback waits for lock; room transitions to RESULTS once."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room_manager.register_player(room.room_id, "Bob")
        room.config.game_mode = "classic"

        await orchestrator.handle_start_game(room.room_id, "Alice")

        # Alice answers, then timer fires — both should complete without corruption
        await orchestrator.handle_answer(
            room.room_id, "Alice", room.questions[0].answer
        )
        await orchestrator._on_question_timeout(room.room_id)

        # Room should be in RESULTS (timer transitioned it since not all answered)
        assert room.status == GameStatus.RESULTS
        # Alice's answer should be recorded
        assert "Alice" in room.answered_players
        assert room.scores["Alice"] > 0


class TestOrchestratorSpeedBattleDelegation:
    """Tests for Speed Battle mode delegation points in GameOrchestrator."""

    def _make_mock_handler(self):
        """Return a MagicMock that looks like SpeedBattleHandler."""
        handler = MagicMock()
        handler.start_match = AsyncMock()
        handler.handle_answer = AsyncMock()
        handler.handle_connect = AsyncMock()
        handler.cleanup_room = MagicMock()
        handler.build_per_recipient_closure = MagicMock(return_value=lambda _pid: {})
        return handler

    def _make_orchestrator(
        self,
        room_manager,
        game_service,
        timer_service,
        state_builder,
        mock_room_closer,
        handler,
    ):
        """Create orchestrator wired with a mock handler."""
        orch = GameOrchestrator(
            room_manager=room_manager,
            game_service=game_service,
            timer_service=timer_service,
            state_builder=state_builder,
            room_closer=mock_room_closer,
            speed_battle_handler=handler,
        )
        handler.set_orchestrator = MagicMock()
        return orch

    async def test_handle_start_game_speed_battle_calls_start_match(
        self, orchestrator: GameOrchestrator, room_manager, monkeypatch
    ):
        """handle_start_game with speed_battle delegates to handler.start_match."""
        import app.services.orchestration.orchestrator as orch_mod

        monkeypatch.setattr(orch_mod, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)

        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"
        room.config.multiple_choice_enabled = True

        await orchestrator.handle_start_game(room.room_id, "Alice")

        mock_handler.start_match.assert_awaited_once()
        assert room.status == GameStatus.PLAYING

    async def test_handle_start_game_speed_battle_mc_gate_sends_error(
        self, orchestrator: GameOrchestrator, room_manager, monkeypatch
    ):
        """handle_start_game with speed_battle + MC off sends ERROR and does not start."""
        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"
        room.config.multiple_choice_enabled = False

        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock()
        room_manager.attach_connection(room.room_id, "Alice", mock_ws)

        await orchestrator.handle_start_game(room.room_id, "Alice")

        mock_handler.start_match.assert_not_awaited()
        assert room.status == GameStatus.WAITING
        mock_ws.send_json.assert_awaited_once()
        sent = mock_ws.send_json.call_args[0][0]
        assert sent["type"] == "ERROR"

    async def test_handle_start_game_speed_battle_r7_too_few_questions(
        self, orchestrator: GameOrchestrator, room_manager, monkeypatch
    ):
        """R7: when fewer questions returned than pool size, start_match not called, ERROR sent."""
        import app.services.orchestration.orchestrator as orch_mod

        monkeypatch.setattr(orch_mod, "SPEED_BATTLE_QUESTION_POOL_SIZE", 1000)

        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"
        room.config.multiple_choice_enabled = True

        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock()
        room_manager.attach_connection(room.room_id, "Alice", mock_ws)

        await orchestrator.handle_start_game(room.room_id, "Alice")

        mock_handler.start_match.assert_not_awaited()
        assert room.status == GameStatus.WAITING
        mock_ws.send_json.assert_awaited_once()
        sent = mock_ws.send_json.call_args[0][0]
        assert sent["type"] == "ERROR"

    async def test_handle_answer_speed_battle_delegates_to_handler(
        self, orchestrator: GameOrchestrator, room_manager, monkeypatch
    ):
        """handle_answer in speed_battle delegates to handler, not Classic path."""
        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"
        room.status = GameStatus.PLAYING

        await orchestrator.handle_answer(
            room.room_id, "Alice", "Paris", question_index=0
        )

        mock_handler.handle_answer.assert_awaited_once_with(room, "Alice", "Paris", 0)
        assert "Alice" not in room.answered_players  # Classic path not entered

    async def test_handle_start_game_speed_battle_increments_sb_counter(
        self, orchestrator: GameOrchestrator, room_manager, monkeypatch
    ):
        """handle_start_game for Speed Battle increments speed_battle_matches_started_total."""
        import app.services.orchestration.orchestrator as orch_mod

        monkeypatch.setattr(orch_mod, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)

        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"
        room.config.multiple_choice_enabled = True

        before = (
            REGISTRY.get_sample_value("jduel_speed_battle_matches_started_total") or 0.0
        )
        await orchestrator.handle_start_game(room.room_id, "Alice")
        after = (
            REGISTRY.get_sample_value("jduel_speed_battle_matches_started_total") or 0.0
        )

        assert after - before == 1.0

    async def test_handle_start_game_classic_does_not_increment_sb_counter(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """handle_start_game for Classic mode does not increment the SB-specific counter."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "classic"

        before = (
            REGISTRY.get_sample_value("jduel_speed_battle_matches_started_total") or 0.0
        )
        await orchestrator.handle_start_game(room.room_id, "Alice")
        after = (
            REGISTRY.get_sample_value("jduel_speed_battle_matches_started_total") or 0.0
        )

        assert after == before

    async def test_handle_answer_classic_mode_not_delegated(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Classic mode handle_answer does not delegate to handler."""
        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room_manager.register_player(room.room_id, "Bob")
        room.config.game_mode = "classic"

        await orchestrator.handle_start_game(room.room_id, "Alice")
        await orchestrator.handle_answer(room.room_id, "Alice", "Paris")

        mock_handler.handle_answer.assert_not_awaited()
        assert "Alice" in room.answered_players

    async def test_handle_connect_speed_battle_playing_delegates_to_handler(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """handle_connect in speed_battle PLAYING delegates to handler.handle_connect."""
        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"
        room.status = GameStatus.PLAYING

        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock()
        result = await orchestrator.handle_connect(room.room_id, "Alice", mock_ws)

        assert result is True
        mock_handler.handle_connect.assert_awaited_once_with(room, "Alice")

    async def test_handle_connect_speed_battle_waiting_uses_classic_broadcast(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """Speed Battle WAITING lobby uses Classic broadcast (no handler delegation)."""
        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        room.config.game_mode = "speed_battle"
        # room.status is WAITING by default

        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock()
        result = await orchestrator.handle_connect(room.room_id, "Alice", mock_ws)

        assert result is True
        mock_handler.handle_connect.assert_not_awaited()
        mock_ws.send_json.assert_awaited_once()  # Classic broadcast to the single WS

    async def test_handle_disconnect_last_player_calls_cleanup_room(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """handle_disconnect (last player) calls handler.cleanup_room regardless of mode."""
        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock()
        await orchestrator.handle_connect(room.room_id, "Alice", mock_ws)
        room_id = room.room_id

        await orchestrator.handle_disconnect(room_id, "Alice")

        mock_handler.cleanup_room.assert_called_once_with(room_id)
        assert room_manager.get_room(room_id) is None

    async def test_handle_play_again_calls_cleanup_room(
        self, orchestrator: GameOrchestrator, room_manager
    ):
        """handle_play_again calls handler.cleanup_room before resetting state."""
        mock_handler = self._make_mock_handler()
        orchestrator._speed_battle_handler = mock_handler

        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        mock_ws = MagicMock()
        mock_ws.send_json = AsyncMock()
        await orchestrator.handle_connect(room.room_id, "Alice", mock_ws)
        room.status = GameStatus.FINISHED

        await orchestrator.handle_play_again(room.room_id, "Alice")

        mock_handler.cleanup_room.assert_called_once_with(room.room_id)
        assert room.status == GameStatus.WAITING

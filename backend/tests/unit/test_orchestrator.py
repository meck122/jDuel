"""Tests for GameOrchestrator."""

from unittest.mock import MagicMock

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

        assert room.config.difficulty == "enjoyer"  # default, unchanged

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

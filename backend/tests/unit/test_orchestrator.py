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

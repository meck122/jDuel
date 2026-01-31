"""Tests for ConnectionManager."""

from unittest.mock import AsyncMock, MagicMock

from app.services.core.connection_manager import ConnectionManager
from app.services.core.room_repository import RoomRepository


class TestConnectionManager:
    """Test suite for ConnectionManager."""

    def test_attach_stores_websocket(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """Attaching a WebSocket stores it in room.connections."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        mock_ws = MagicMock()

        result = connection_manager.attach(room.room_id, "Alice", mock_ws)

        assert result is True
        assert room.connections["Alice"] is mock_ws

    def test_attach_returns_false_for_unregistered_player(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """Attaching to an unregistered player returns False."""
        room = room_repository.create([])
        mock_ws = MagicMock()

        result = connection_manager.attach(room.room_id, "Ghost", mock_ws)

        assert result is False
        assert "Ghost" not in room.connections

    def test_attach_returns_false_for_nonexistent_room(
        self, connection_manager: ConnectionManager
    ):
        """Attaching to a non-existent room returns False."""
        mock_ws = MagicMock()
        result = connection_manager.attach("ZZZZ", "Alice", mock_ws)
        assert result is False

    def test_detach_removes_websocket(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """Detaching removes the WebSocket but keeps the player registered."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        mock_ws = MagicMock()
        connection_manager.attach(room.room_id, "Alice", mock_ws)

        connection_manager.detach(room.room_id, "Alice")

        assert "Alice" not in room.connections
        assert "Alice" in room.players  # Still registered

    async def test_broadcast_sends_to_all_connections(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """broadcast() calls send_json on every connected WebSocket."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        room_repository.register_player(room.room_id, "Bob")

        ws_alice = MagicMock()
        ws_alice.send_json = AsyncMock()
        ws_bob = MagicMock()
        ws_bob.send_json = AsyncMock()

        connection_manager.attach(room.room_id, "Alice", ws_alice)
        connection_manager.attach(room.room_id, "Bob", ws_bob)

        state = {"type": "ROOM_STATE", "roomState": {"status": "waiting"}}
        await connection_manager.broadcast(room.room_id, state)

        ws_alice.send_json.assert_called_once_with(state)
        ws_bob.send_json.assert_called_once_with(state)

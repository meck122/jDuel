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

    # --- Per-recipient broadcast ---

    async def test_broadcast_per_recipient_sends_closure_output(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """broadcast_per_recipient calls closure per player and sends distinct payloads."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        room_repository.register_player(room.room_id, "Bob")

        ws_alice = MagicMock()
        ws_alice.send_json = AsyncMock()
        ws_bob = MagicMock()
        ws_bob.send_json = AsyncMock()
        connection_manager.attach(room.room_id, "Alice", ws_alice)
        connection_manager.attach(room.room_id, "Bob", ws_bob)

        await connection_manager.broadcast_per_recipient(
            room.room_id, lambda pid: {"player": pid}
        )

        ws_alice.send_json.assert_called_once_with({"player": "Alice"})
        ws_bob.send_json.assert_called_once_with({"player": "Bob"})

    async def test_broadcast_per_recipient_nonexistent_room_no_exception(
        self, connection_manager: ConnectionManager
    ):
        """broadcast_per_recipient on a non-existent room raises no exception."""
        await connection_manager.broadcast_per_recipient("ZZZZ", lambda _pid: {})

    async def test_broadcast_per_recipient_one_send_fails_others_still_receive(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """If one send raises, the other player still receives their payload."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        room_repository.register_player(room.room_id, "Bob")

        ws_alice = MagicMock()
        ws_alice.send_json = AsyncMock(side_effect=Exception("network error"))
        ws_bob = MagicMock()
        ws_bob.send_json = AsyncMock()
        connection_manager.attach(room.room_id, "Alice", ws_alice)
        connection_manager.attach(room.room_id, "Bob", ws_bob)

        await connection_manager.broadcast_per_recipient(
            room.room_id, lambda pid: {"player": pid}
        )

        ws_bob.send_json.assert_called_once_with({"player": "Bob"})

    async def test_broadcast_per_recipient_dict_mutation_no_runtime_error(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """Concurrent disconnect mid-iteration does not raise RuntimeError."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        room_repository.register_player(room.room_id, "Bob")

        ws_alice = MagicMock()
        ws_bob = MagicMock()

        async def alice_send(_payload):
            # Simulate concurrent disconnect mid-broadcast by mutating connections
            room.connections.pop("Bob", None)

        ws_alice.send_json = AsyncMock(side_effect=alice_send)
        ws_bob.send_json = AsyncMock()
        connection_manager.attach(room.room_id, "Alice", ws_alice)
        connection_manager.attach(room.room_id, "Bob", ws_bob)

        # Must not raise RuntimeError: dictionary changed size during iteration
        await connection_manager.broadcast_per_recipient(
            room.room_id, lambda pid: {"player": pid}
        )

    # --- send_to_player ---

    async def test_send_to_player_sends_to_one_socket(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """send_to_player sends only to the specified player."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        room_repository.register_player(room.room_id, "Bob")

        ws_alice = MagicMock()
        ws_alice.send_json = AsyncMock()
        ws_bob = MagicMock()
        ws_bob.send_json = AsyncMock()
        connection_manager.attach(room.room_id, "Alice", ws_alice)
        connection_manager.attach(room.room_id, "Bob", ws_bob)

        await connection_manager.send_to_player(
            room.room_id, "Alice", {"hello": "alice"}
        )

        ws_alice.send_json.assert_called_once_with({"hello": "alice"})
        ws_bob.send_json.assert_not_called()

    async def test_send_to_player_not_connected_no_exception(
        self, room_repository: RoomRepository, connection_manager: ConnectionManager
    ):
        """send_to_player to a player not in connections raises no exception."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        # Alice not attached
        await connection_manager.send_to_player(room.room_id, "Alice", {})

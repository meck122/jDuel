"""Tests for websocket_handler helpers."""

from unittest.mock import MagicMock

from app.api.websocket_handler import _is_active_connection


class TestIsActiveConnection:
    """Tests for the identity-aware check used to gate handle_disconnect."""

    def test_returns_true_when_ws_is_bound_to_player(self):
        ws = MagicMock()
        room = MagicMock()
        room.connections = {"Alice": ws}
        room_manager = MagicMock()
        room_manager.get_room.return_value = room

        assert _is_active_connection(room_manager, "RM1", "Alice", ws) is True

    def test_returns_false_when_a_different_ws_replaced_us(self):
        """A same-token rejoin attaches a fresh WS; the displaced WS must
        not run handle_disconnect or it would detach the new one."""
        stale_ws = MagicMock()
        new_ws = MagicMock()
        room = MagicMock()
        room.connections = {"Alice": new_ws}
        room_manager = MagicMock()
        room_manager.get_room.return_value = room

        assert _is_active_connection(room_manager, "RM1", "Alice", stale_ws) is False

    def test_returns_false_when_player_not_in_connections(self):
        ws = MagicMock()
        room = MagicMock()
        room.connections = {}
        room_manager = MagicMock()
        room_manager.get_room.return_value = room

        assert _is_active_connection(room_manager, "RM1", "Alice", ws) is False

    def test_returns_false_when_room_no_longer_exists(self):
        ws = MagicMock()
        room_manager = MagicMock()
        room_manager.get_room.return_value = None

        assert _is_active_connection(room_manager, "RM1", "Alice", ws) is False

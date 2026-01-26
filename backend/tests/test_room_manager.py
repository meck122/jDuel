"""Tests for RoomManager."""

import pytest


class TestRoomManager:
    """Test suite for RoomManager."""

    def test_create_room(self, room_manager):
        """Test creating a new room."""
        room = room_manager.create_room()

        assert room is not None
        assert len(room.room_id) == 4
        assert room.room_id.isupper() or room.room_id.isdigit()
        assert len(room.questions) == 10

    def test_get_room(self, room_manager):
        """Test retrieving an existing room."""
        created_room = room_manager.create_room()

        retrieved_room = room_manager.get_room(created_room.room_id)

        assert retrieved_room is created_room

    def test_get_nonexistent_room(self, room_manager):
        """Test retrieving a room that doesn't exist."""
        room = room_manager.get_room("XXXX")

        assert room is None

    def test_delete_room(self, room_manager):
        """Test deleting a room."""
        room = room_manager.create_room()
        room_id = room.room_id

        room_manager.delete_room(room_id)

        assert room_manager.get_room(room_id) is None

    def test_delete_nonexistent_room(self, room_manager):
        """Test deleting a room that doesn't exist (should not raise)."""
        room_manager.delete_room("XXXX")  # Should not raise

    def test_register_player(self, room_manager):
        """Test registering a player in a room."""
        room = room_manager.create_room()

        result = room_manager.register_player(room.room_id, "player1")

        assert result is True
        assert "player1" in room.players
        assert room.scores["player1"] == 0

    def test_register_player_duplicate(self, room_manager):
        """Test registering the same player twice."""
        room = room_manager.create_room()

        room_manager.register_player(room.room_id, "player1")
        result = room_manager.register_player(room.room_id, "player1")

        assert result is False

    def test_register_player_nonexistent_room(self, room_manager):
        """Test registering a player in a non-existent room."""
        result = room_manager.register_player("XXXX", "player1")

        assert result is False

    def test_unique_room_codes(self, room_manager):
        """Test that room codes are unique."""
        rooms = [room_manager.create_room() for _ in range(10)]
        room_ids = [room.room_id for room in rooms]

        assert len(room_ids) == len(set(room_ids))

"""Tests for RoomManager."""

import string


class TestRoomManager:
    """Test suite for RoomManager."""

    def test_create_room_returns_room_with_empty_questions(self, room_manager):
        """Questions are empty at creation; they load at game start."""
        room = room_manager.create_room()
        assert len(room.questions) == 0

    def test_create_room_id_is_valid_format(self, room_manager):
        """Room ID is 4 uppercase alphanumeric characters."""
        room = room_manager.create_room()
        assert len(room.room_id) == 4
        assert all(c in string.ascii_uppercase + string.digits for c in room.room_id)

    def test_get_room_returns_created_room(self, room_manager):
        """get_room returns the same room object that was created."""
        created = room_manager.create_room()
        retrieved = room_manager.get_room(created.room_id)
        assert retrieved is created

    def test_load_questions_by_difficulty_populates_room(self, room_manager):
        """Questions are empty after create, populated after load."""
        room = room_manager.create_room()
        assert len(room.questions) == 0

        room_manager.load_questions_by_difficulty(room.room_id, 1, 5, count=10)
        assert len(room.questions) == 10

    def test_register_player_success(self, room_manager):
        """Registering a new player returns True and adds them."""
        room = room_manager.create_room()
        result = room_manager.register_player(room.room_id, "Alice")

        assert result is True
        assert "Alice" in room.players
        assert room.scores["Alice"] == 0

    def test_register_player_duplicate_returns_false(self, room_manager):
        """Registering the same player twice returns False."""
        room = room_manager.create_room()
        room_manager.register_player(room.room_id, "Alice")
        result = room_manager.register_player(room.room_id, "Alice")
        assert result is False

    def test_delete_room(self, room_manager):
        """Deleted room is no longer retrievable."""
        room = room_manager.create_room()
        room_id = room.room_id
        room_manager.delete_room(room_id)
        assert room_manager.get_room(room_id) is None

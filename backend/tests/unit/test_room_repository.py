"""Tests for RoomRepository."""

import string

from app.services.core.room_repository import RoomRepository


class TestRoomRepository:
    """Test suite for RoomRepository."""

    def test_create_returns_room_with_valid_id(self, room_repository: RoomRepository):
        """Room ID is 4 uppercase alphanumeric characters."""
        room = room_repository.create([])
        assert len(room.room_id) == 4
        assert all(c in string.ascii_uppercase + string.digits for c in room.room_id)

    def test_create_stores_room_retrievable_by_id(
        self, room_repository: RoomRepository
    ):
        """Created room can be retrieved by its ID."""
        room = room_repository.create([])
        retrieved = room_repository.get(room.room_id)
        assert retrieved is room

    def test_get_returns_none_for_missing_room(self, room_repository: RoomRepository):
        """get() returns None for a room ID that doesn't exist."""
        assert room_repository.get("ZZZZ") is None

    def test_delete_removes_room(self, room_repository: RoomRepository):
        """Deleted room is no longer retrievable."""
        room = room_repository.create([])
        room_id = room.room_id
        room_repository.delete(room_id)
        assert room_repository.get(room_id) is None

    def test_delete_nonexistent_is_noop(self, room_repository: RoomRepository):
        """Deleting a non-existent room does not raise."""
        room_repository.delete("ZZZZ")  # Should not raise

    def test_register_first_player_becomes_host(self, room_repository: RoomRepository):
        """First registered player is set as host."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        assert room.host_id == "Alice"

    def test_register_second_player_does_not_change_host(
        self, room_repository: RoomRepository
    ):
        """Second player registration does not change the host."""
        room = room_repository.create([])
        room_repository.register_player(room.room_id, "Alice")
        room_repository.register_player(room.room_id, "Bob")
        assert room.host_id == "Alice"

    def test_register_duplicate_returns_false(self, room_repository: RoomRepository):
        """Registering the same player ID twice returns False."""
        room = room_repository.create([])
        assert room_repository.register_player(room.room_id, "Alice") is True
        assert room_repository.register_player(room.room_id, "Alice") is False

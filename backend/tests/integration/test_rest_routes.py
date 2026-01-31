"""Integration tests for HTTP REST routes."""

from fastapi.testclient import TestClient


class TestCreateRoom:
    """Tests for POST /api/rooms."""

    def test_create_room_200(self, client: TestClient):
        """Creating a room returns 200 with valid roomId."""
        resp = client.post("/api/rooms")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["roomId"]) == 4
        assert data["status"] == "waiting"
        assert data["playerCount"] == 0

    def test_create_room_ids_are_unique(self, client: TestClient):
        """Two room creations yield different roomIds."""
        r1 = client.post("/api/rooms").json()
        r2 = client.post("/api/rooms").json()
        assert r1["roomId"] != r2["roomId"]


class TestJoinRoom:
    """Tests for POST /api/rooms/{roomId}/join."""

    def _create_room(self, client: TestClient) -> str:
        return client.post("/api/rooms").json()["roomId"]

    def test_join_success(self, client: TestClient):
        """Joining a room succeeds and echoes playerId with session token."""
        room_id = self._create_room(client)
        resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Alice"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["playerId"] == "Alice"
        assert data["status"] == "waiting"
        assert data["roomId"] == room_id
        assert "sessionToken" in data
        assert len(data["sessionToken"]) > 0

    def test_join_404_nonexistent_room(self, client: TestClient):
        """Joining a non-existent room returns 404."""
        resp = client.post("/api/rooms/ZZZZ/join", json={"playerId": "Alice"})
        assert resp.status_code == 404
        assert resp.json()["detail"]["code"] == "ROOM_NOT_FOUND"

    def test_join_409_name_taken_while_connected(
        self, client: TestClient, test_container
    ):
        """Joining with a name that is actively connected returns 409 NAME_TAKEN."""
        room_id = self._create_room(client)
        # Register Alice via HTTP
        client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Alice"})

        # Simulate Alice being connected by populating room.connections
        room = test_container.room_manager.get_room(room_id)
        from unittest.mock import MagicMock

        room.connections["Alice"] = MagicMock()

        # Try to join as Alice again — she's "connected"
        resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Alice"})
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "NAME_TAKEN"

    def test_join_allows_reconnect_when_disconnected(self, client: TestClient):
        """A registered but disconnected player can rejoin (reconnect path)."""
        room_id = self._create_room(client)
        # Register Alice and get session token
        first_resp = client.post(
            f"/api/rooms/{room_id}/join", json={"playerId": "Alice"}
        )
        session_token = first_resp.json()["sessionToken"]

        # Alice is NOT in connections (disconnected) — join again with token
        resp = client.post(
            f"/api/rooms/{room_id}/join",
            json={"playerId": "Alice", "sessionToken": session_token},
        )
        assert resp.status_code == 200
        assert resp.json()["playerId"] == "Alice"

    def test_join_rejects_reconnect_with_wrong_token(self, client: TestClient):
        """Reconnecting with wrong session token returns 403."""
        room_id = self._create_room(client)
        # Register Alice
        client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Alice"})

        # Try to reconnect with wrong token
        resp = client.post(
            f"/api/rooms/{room_id}/join",
            json={"playerId": "Alice", "sessionToken": "wrong-token"},
        )
        assert resp.status_code == 403
        assert resp.json()["detail"]["code"] == "INVALID_SESSION"

    def test_join_409_game_started_new_player(self, client: TestClient, test_container):
        """New player cannot join after game has started."""
        room_id = self._create_room(client)
        client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Alice"})

        # Force game started state
        room = test_container.room_manager.get_room(room_id)
        from app.models import GameStatus

        room.status = GameStatus.PLAYING

        resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Bob"})
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "GAME_STARTED"

    def test_join_allows_existing_player_after_game_started(
        self, client: TestClient, test_container
    ):
        """Existing player can rejoin after game started (reconnection)."""
        room_id = self._create_room(client)
        first_resp = client.post(
            f"/api/rooms/{room_id}/join", json={"playerId": "Alice"}
        )
        session_token = first_resp.json()["sessionToken"]

        # Force game started
        room = test_container.room_manager.get_room(room_id)
        from app.models import GameStatus

        room.status = GameStatus.PLAYING

        # Alice rejoining should work (she's an existing player with valid token)
        resp = client.post(
            f"/api/rooms/{room_id}/join",
            json={"playerId": "Alice", "sessionToken": session_token},
        )
        assert resp.status_code == 200

    def test_join_validates_empty_player_id(self, client: TestClient):
        """Empty playerId returns 422 validation error."""
        room_id = self._create_room(client)
        resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": ""})
        assert resp.status_code == 422

    def test_join_validates_long_player_id(self, client: TestClient):
        """Player ID exceeding 20 chars returns 422 validation error."""
        room_id = self._create_room(client)
        resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": "A" * 21})
        assert resp.status_code == 422


class TestHealth:
    """Tests for GET /health."""

    def test_health_200(self, client: TestClient):
        """Health endpoint returns 200 with status ok."""
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

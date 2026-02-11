"""Integration tests for WebSocket game communication."""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


def _setup_room(client: TestClient, players: list[str]) -> str:
    """Helper: create a room and register all players. Returns roomId."""
    room_id = client.post("/api/rooms").json()["roomId"]
    for name in players:
        client.post(f"/api/rooms/{room_id}/join", json={"playerId": name})
    return room_id


def _assert_ws_close_code(client: TestClient, url: str, expected_code: int):
    """Assert that a WebSocket connection is closed with the expected code.

    The server rejects before accepting, so TestClient raises WebSocketDisconnect.
    The code is on exc.code, not in the string representation.
    """
    with pytest.raises(WebSocketDisconnect) as exc_info, client.websocket_connect(url):
        pass
    assert exc_info.value.code == expected_code


class TestWebSocketConnection:
    """Tests for WebSocket connection lifecycle."""

    def test_connect_4004_nonexistent_room(self, client: TestClient):
        """Connecting to a non-existent room closes with code 4004."""
        _assert_ws_close_code(client, "/ws?roomId=ZZZZ&playerId=Alice", 4004)

    def test_connect_4003_unregistered_player(self, client: TestClient):
        """Connecting as an unregistered player closes with code 4003."""
        room_id = _setup_room(client, ["Alice"])
        _assert_ws_close_code(client, f"/ws?roomId={room_id}&playerId=Ghost", 4003)

    def test_connect_4009_already_connected(self, client: TestClient, test_container):
        """Connecting when already connected closes with code 4009."""
        room_id = _setup_room(client, ["Alice"])

        # First connection — keep it open
        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws1:
            ws1.receive_json()  # consume ROOM_STATE

            # Second connection attempt should be rejected with 4009
            _assert_ws_close_code(client, f"/ws?roomId={room_id}&playerId=Alice", 4009)

    def test_connect_receives_room_state(self, client: TestClient):
        """First message after connection is ROOM_STATE with status=waiting."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "ROOM_STATE"
            assert msg["roomState"]["status"] == "waiting"
            assert msg["roomState"]["hostId"] == "Alice"


class TestWebSocketGameFlow:
    """Tests for WebSocket game flow messages."""

    def test_start_game_transitions_to_playing(self, client: TestClient):
        """Sending START_GAME transitions room to playing with a question."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            ws.receive_json()  # initial ROOM_STATE (waiting)
            ws.send_json({"type": "START_GAME"})
            msg = ws.receive_json()

            assert msg["type"] == "ROOM_STATE"
            assert msg["roomState"]["status"] == "playing"
            assert "currentQuestion" in msg["roomState"]
            assert msg["roomState"]["currentQuestion"]["text"] != ""

    def test_start_game_non_host_ignored(self, client: TestClient, test_container):
        """Non-host sending START_GAME does not change room status."""
        room_id = _setup_room(client, ["Alice", "Bob"])

        with client.websocket_connect(
            f"/ws?roomId={room_id}&playerId=Alice"
        ) as ws_alice:
            ws_alice.receive_json()  # initial state

            with client.websocket_connect(
                f"/ws?roomId={room_id}&playerId=Bob"
            ) as ws_bob:
                ws_bob.receive_json()  # initial state
                # Alice also gets broadcast when Bob connects
                ws_alice.receive_json()

                # Bob (non-host) tries to start
                ws_bob.send_json({"type": "START_GAME"})

                # Verify via container that status is still waiting
                room = test_container.room_manager.get_room(room_id)
                assert room.status.value == "waiting"

    def test_correct_answer_transitions_to_results(self, client: TestClient):
        """Single player giving correct answer triggers transition to results."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            ws.receive_json()  # waiting state
            ws.send_json({"type": "START_GAME"})
            ws.receive_json()  # playing state

            # Get the correct answer for the current question
            # sample_questions[0] answer is "4"
            ws.send_json({"type": "ANSWER", "answer": "4"})
            results_msg = ws.receive_json()

            assert results_msg["type"] == "ROOM_STATE"
            assert results_msg["roomState"]["status"] == "results"
            assert "results" in results_msg["roomState"]

    def test_incorrect_answer_also_transitions_to_results(self, client: TestClient):
        """Single player giving wrong answer still triggers results (all answered)."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            ws.receive_json()  # waiting
            ws.send_json({"type": "START_GAME"})
            ws.receive_json()  # playing

            ws.send_json({"type": "ANSWER", "answer": "totally_wrong"})
            results_msg = ws.receive_json()

            assert results_msg["roomState"]["status"] == "results"

    def test_config_update_changes_difficulty(self, client: TestClient):
        """Host sending UPDATE_CONFIG updates difficulty in broadcasted state."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            ws.receive_json()  # initial state

            ws.send_json({"type": "UPDATE_CONFIG", "config": {"difficulty": "beast"}})
            msg = ws.receive_json()

            assert msg["roomState"]["config"]["difficulty"] == "beast"

    def test_config_update_ignored_after_game_start(
        self, client: TestClient, test_container
    ):
        """UPDATE_CONFIG after game start is ignored."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            ws.receive_json()  # waiting
            ws.send_json({"type": "START_GAME"})
            ws.receive_json()  # playing

            # Try to update config while playing
            ws.send_json({"type": "UPDATE_CONFIG", "config": {"difficulty": "beast"}})

            # Verify via container that config is unchanged
            room = test_container.room_manager.get_room(room_id)
            assert room.config.difficulty == "enjoyer"


class TestPlayAgain:
    """Tests for the Play Again feature."""

    def _play_to_finished(self, ws, test_container, room_id: str):
        """Helper: play a single-player game to FINISHED state via WS."""
        ws.send_json({"type": "START_GAME"})
        ws.receive_json()  # playing state

        room = test_container.room_manager.get_room(room_id)
        questions = room.questions

        for i in range(len(questions)):
            ws.send_json({"type": "ANSWER", "answer": questions[i].answer})
            ws.receive_json()  # results state
            # Trigger results timeout to advance
            import asyncio

            asyncio.get_event_loop().run_until_complete(
                test_container.orchestrator._on_results_timeout(room_id)
            )
            ws.receive_json()  # next playing or finished state

        assert room.status.value == "finished"

    def test_play_again_resets_to_lobby(self, client: TestClient, test_container):
        """Host sending PLAY_AGAIN after game ends returns to waiting state."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            ws.receive_json()  # initial waiting state
            self._play_to_finished(ws, test_container, room_id)

            # Now send PLAY_AGAIN
            ws.send_json({"type": "PLAY_AGAIN"})
            msg = ws.receive_json()

            assert msg["type"] == "ROOM_STATE"
            assert msg["roomState"]["status"] == "waiting"
            assert msg["roomState"]["players"]["Alice"] == 0  # Score reset

    def test_play_again_then_new_game(self, client: TestClient, test_container):
        """After play again, host can start a new game successfully."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            ws.receive_json()  # waiting
            self._play_to_finished(ws, test_container, room_id)

            # Play again
            ws.send_json({"type": "PLAY_AGAIN"})
            msg = ws.receive_json()
            assert msg["roomState"]["status"] == "waiting"

            # Start a new game
            ws.send_json({"type": "START_GAME"})
            msg = ws.receive_json()
            assert msg["roomState"]["status"] == "playing"
            assert "currentQuestion" in msg["roomState"]

    def test_new_player_joins_after_play_again(
        self, client: TestClient, test_container
    ):
        """New player can join the room after play again resets to lobby."""
        room_id = _setup_room(client, ["Alice"])

        with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
            ws.receive_json()  # waiting
            self._play_to_finished(ws, test_container, room_id)

            # Play again
            ws.send_json({"type": "PLAY_AGAIN"})
            ws.receive_json()  # waiting

            # New player joins via HTTP
            resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Bob"})
            assert resp.status_code == 200

            # Bob can connect via WebSocket
            with client.websocket_connect(
                f"/ws?roomId={room_id}&playerId=Bob"
            ) as ws_bob:
                msg = ws_bob.receive_json()
                assert msg["type"] == "ROOM_STATE"
                assert msg["roomState"]["status"] == "waiting"
                assert "Bob" in msg["roomState"]["players"]

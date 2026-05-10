"""Integration tests for WebSocket game communication."""

import asyncio

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


def _setup_room(client: TestClient, players: list[str]) -> tuple[str, dict[str, str]]:
    """Helper: create a room and register all players.

    Returns:
        Tuple of (roomId, {playerName: sessionToken}).
    """
    room_id = client.post("/api/rooms").json()["roomId"]
    tokens: dict[str, str] = {}
    for name in players:
        resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": name})
        tokens[name] = resp.json()["sessionToken"]
    return room_id, tokens


def _ws_url(room_id: str, player_id: str, token: str) -> str:
    """Build a WebSocket URL with the required sessionToken query param."""
    return f"/ws?roomId={room_id}&playerId={player_id}&sessionToken={token}"


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
        _assert_ws_close_code(
            client, "/ws?roomId=ZZZZ&playerId=Alice&sessionToken=sometoken", 4004
        )

    def test_connect_4003_unregistered_player(self, client: TestClient):
        """Connecting as an unregistered player closes with code 4003."""
        room_id, _ = _setup_room(client, ["Alice"])
        _assert_ws_close_code(
            client, f"/ws?roomId={room_id}&playerId=Ghost&sessionToken=sometoken", 4003
        )

    def test_connect_4008_invalid_token(self, client: TestClient):
        """Connecting with the wrong session token closes with code 4008."""
        room_id, _ = _setup_room(client, ["Alice"])
        _assert_ws_close_code(
            client,
            f"/ws?roomId={room_id}&playerId=Alice&sessionToken=wrongtoken",
            4008,
        )

    def test_connect_missing_token_rejected(self, client: TestClient):
        """Omitting the required sessionToken query param is rejected.

        FastAPI returns HTTP 422 for the missing required query param; Starlette's
        TestClient surfaces this as WebSocketDisconnect with code 1008 (policy violation).
        """
        room_id, _ = _setup_room(client, ["Alice"])
        _assert_ws_close_code(client, f"/ws?roomId={room_id}&playerId=Alice", 1008)

    def test_connect_4009_already_connected(self, client: TestClient, test_container):
        """Connecting when already connected closes with code 4009."""
        room_id, tokens = _setup_room(client, ["Alice"])

        # First connection — keep it open
        with client.websocket_connect(
            _ws_url(room_id, "Alice", tokens["Alice"])
        ) as ws1:
            ws1.receive_json()  # consume ROOM_STATE

            # Second connection attempt (valid token) should be rejected with 4009
            _assert_ws_close_code(
                client, _ws_url(room_id, "Alice", tokens["Alice"]), 4009
            )

    def test_connect_receives_room_state(self, client: TestClient):
        """First message after connection is ROOM_STATE with status=waiting."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            msg = ws.receive_json()
            assert msg["type"] == "ROOM_STATE"
            assert msg["roomState"]["status"] == "waiting"
            assert msg["roomState"]["hostId"] == "Alice"

    def test_connect_valid_token_succeeds(self, client: TestClient):
        """Connecting with the correct session token succeeds."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            msg = ws.receive_json()
            assert msg["type"] == "ROOM_STATE"


class TestWebSocketGameFlow:
    """Tests for WebSocket game flow messages."""

    def test_start_game_transitions_to_playing(self, client: TestClient):
        """Sending START_GAME transitions room to playing with a question."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # initial ROOM_STATE (waiting)
            ws.send_json({"type": "UPDATE_CONFIG", "config": {"gameMode": "classic"}})
            ws.receive_json()  # config updated
            ws.send_json({"type": "START_GAME"})
            msg = ws.receive_json()

            assert msg["type"] == "ROOM_STATE"
            assert msg["roomState"]["status"] == "playing"
            assert "currentQuestion" in msg["roomState"]
            assert msg["roomState"]["currentQuestion"]["text"] != ""

    def test_start_game_non_host_ignored(self, client: TestClient, test_container):
        """Non-host sending START_GAME does not change room status."""
        room_id, tokens = _setup_room(client, ["Alice", "Bob"])

        with client.websocket_connect(
            _ws_url(room_id, "Alice", tokens["Alice"])
        ) as ws_alice:
            ws_alice.receive_json()  # initial state

            with client.websocket_connect(
                _ws_url(room_id, "Bob", tokens["Bob"])
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
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # waiting state
            ws.send_json({"type": "UPDATE_CONFIG", "config": {"gameMode": "classic"}})
            ws.receive_json()  # config updated
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
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # waiting
            ws.send_json({"type": "UPDATE_CONFIG", "config": {"gameMode": "classic"}})
            ws.receive_json()  # config updated
            ws.send_json({"type": "START_GAME"})
            ws.receive_json()  # playing

            ws.send_json({"type": "ANSWER", "answer": "totally_wrong"})
            results_msg = ws.receive_json()

            assert results_msg["roomState"]["status"] == "results"

    def test_config_update_changes_difficulty(self, client: TestClient):
        """Host sending UPDATE_CONFIG updates difficulty in broadcasted state."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # initial state

            ws.send_json({"type": "UPDATE_CONFIG", "config": {"difficulty": "beast"}})
            msg = ws.receive_json()

            assert msg["roomState"]["config"]["difficulty"] == "beast"

    def test_config_update_difficulty_baby(self, client: TestClient):
        """Host can set difficulty to 'baby'; broadcasted state reflects it."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # initial state

            ws.send_json({"type": "UPDATE_CONFIG", "config": {"difficulty": "baby"}})
            msg = ws.receive_json()

            assert msg["roomState"]["config"]["difficulty"] == "baby"

    def test_config_update_ignored_after_game_start(
        self, client: TestClient, test_container
    ):
        """UPDATE_CONFIG after game start is ignored."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # waiting
            ws.send_json({"type": "UPDATE_CONFIG", "config": {"gameMode": "classic"}})
            ws.receive_json()  # config updated
            ws.send_json({"type": "START_GAME"})
            ws.receive_json()  # playing

            # Try to update config while playing
            ws.send_json({"type": "UPDATE_CONFIG", "config": {"difficulty": "beast"}})

            # Verify via container that config is unchanged
            room = test_container.room_manager.get_room(room_id)
            assert room.config.difficulty == "enjoyer"

    def test_config_update_game_mode_speed_battle_broadcasts(self, client: TestClient):
        """Host sending gameMode='speed_battle' is reflected in broadcasted ROOM_STATE."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # initial state

            ws.send_json(
                {"type": "UPDATE_CONFIG", "config": {"gameMode": "speed_battle"}}
            )
            msg = ws.receive_json()

            assert msg["roomState"]["config"]["gameMode"] == "speed_battle"

    def test_config_update_game_mode_broadcast_reaches_non_host(
        self, client: TestClient
    ):
        """Both host and non-host WS connections receive the updated gameMode."""
        room_id, tokens = _setup_room(client, ["Alice", "Bob"])

        with (
            client.websocket_connect(
                _ws_url(room_id, "Alice", tokens["Alice"])
            ) as ws_alice,
            client.websocket_connect(_ws_url(room_id, "Bob", tokens["Bob"])) as ws_bob,
        ):
            ws_alice.receive_json()  # Alice's initial state
            ws_bob.receive_json()  # Bob's initial state
            # Bob's connection also triggers an Alice broadcast (new player joined)
            ws_alice.receive_json()

            ws_alice.send_json(
                {"type": "UPDATE_CONFIG", "config": {"gameMode": "speed_battle"}}
            )

            alice_msg = ws_alice.receive_json()
            bob_msg = ws_bob.receive_json()

            assert alice_msg["roomState"]["config"]["gameMode"] == "speed_battle"
            assert bob_msg["roomState"]["config"]["gameMode"] == "speed_battle"


class TestPlayAgain:
    """Tests for the Play Again feature."""

    def _play_to_finished(self, ws, test_container, room_id: str):
        """Helper: play a single-player game to FINISHED state via WS."""
        ws.send_json({"type": "UPDATE_CONFIG", "config": {"gameMode": "classic"}})
        ws.receive_json()  # config updated
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
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
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
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
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
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # waiting
            self._play_to_finished(ws, test_container, room_id)

            # Play again
            ws.send_json({"type": "PLAY_AGAIN"})
            ws.receive_json()  # waiting

            # New player joins via HTTP
            resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Bob"})
            assert resp.status_code == 200
            bob_token = resp.json()["sessionToken"]

            # Bob can connect via WebSocket
            with client.websocket_connect(_ws_url(room_id, "Bob", bob_token)) as ws_bob:
                msg = ws_bob.receive_json()
                assert msg["type"] == "ROOM_STATE"
                assert msg["roomState"]["status"] == "waiting"
                assert "Bob" in msg["roomState"]["players"]


# ---------------------------------------------------------------------------
# Speed Battle integration helpers
# ---------------------------------------------------------------------------


def _sb_patch(monkeypatch, name: str, value) -> None:
    """Patch a Speed Battle constant in all relevant module namespaces."""
    import app.config.game as game_config
    import app.services.orchestration.orchestrator as orch_mod
    import app.services.orchestration.speed_battle_handler as sbh_mod

    monkeypatch.setattr(game_config, name, value)
    monkeypatch.setattr(sbh_mod, name, value)
    if hasattr(orch_mod, name):
        monkeypatch.setattr(orch_mod, name, value)


def _sb_setup(_client, ws, monkeypatch, pool_size=5):
    """Patch pool size, send UPDATE_CONFIG + START_GAME via WS, return playing ROOM_STATE."""
    _sb_patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", pool_size)
    ws.send_json(
        {
            "type": "UPDATE_CONFIG",
            "config": {"gameMode": "speed_battle", "multipleChoiceEnabled": True},
        }
    )
    ws.receive_json()  # ROOM_STATE (waiting, mode updated)
    ws.send_json({"type": "START_GAME"})
    msg = ws.receive_json()  # ROOM_STATE (playing)
    return msg


class TestSpeedBattleIntegration:
    """End-to-end Speed Battle integration tests."""

    def test_start_game_returns_playing_with_speed_battle_block(
        self, client: TestClient, monkeypatch
    ):
        """START_GAME in Speed Battle mode returns ROOM_STATE with speedBattle block."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()  # initial waiting state
            msg = _sb_setup(client, ws, monkeypatch, pool_size=5)

            assert msg["roomState"]["status"] == "playing"
            assert msg["roomState"]["speedBattle"] is not None
            assert msg["roomState"]["speedBattle"]["matchRemainingMs"] > 0
            assert msg["roomState"]["currentQuestion"] is not None
            assert msg["roomState"]["speedBattle"]["playerState"]["questionIndex"] == 0

    def test_correct_answer_advances_question_index(
        self, client: TestClient, test_container, monkeypatch
    ):
        """Correct answer in Speed Battle advances playerState.questionIndex by 1."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            _sb_setup(client, ws, monkeypatch, pool_size=5)

            room = test_container.room_manager.get_room(room_id)
            q0_answer = room.questions[0].answer

            ws.send_json({"type": "ANSWER", "answer": q0_answer, "questionIndex": 0})
            msg = ws.receive_json()

            assert msg["roomState"]["speedBattle"]["playerState"]["questionIndex"] == 1
            assert msg["roomState"]["speedBattle"]["playerState"]["correctCount"] == 1
            assert msg["roomState"]["players"]["Alice"] == 1

    def test_five_correct_answers_advance_five_steps(
        self, client: TestClient, test_container, monkeypatch
    ):
        """Five correct answers in Speed Battle advance player 5 steps."""
        _sb_patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 10)
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            ws.send_json(
                {
                    "type": "UPDATE_CONFIG",
                    "config": {
                        "gameMode": "speed_battle",
                        "multipleChoiceEnabled": True,
                    },
                }
            )
            ws.receive_json()
            ws.send_json({"type": "START_GAME"})
            ws.receive_json()  # playing

            room = test_container.room_manager.get_room(room_id)
            for i in range(5):
                ws.send_json(
                    {
                        "type": "ANSWER",
                        "answer": room.questions[i].answer,
                        "questionIndex": i,
                    }
                )
                ws.receive_json()

            assert room.scores["Alice"] == 5

    def test_wrong_answer_sets_cooldown_fields(
        self, client: TestClient, test_container, monkeypatch
    ):
        """Wrong answer sets cooldownRemainingMs > 0 and cooldownCorrectAnswer."""
        _sb_patch(monkeypatch, "SPEED_BATTLE_WRONG_COOLDOWN_MS", 5_000)
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            _sb_setup(client, ws, monkeypatch, pool_size=5)

            room = test_container.room_manager.get_room(room_id)
            q0_correct = room.questions[0].answer

            ws.send_json(
                {"type": "ANSWER", "answer": "definitely_wrong", "questionIndex": 0}
            )
            msg = ws.receive_json()

            ps = msg["roomState"]["speedBattle"]["playerState"]
            assert ps["cooldownRemainingMs"] is not None
            assert ps["cooldownRemainingMs"] > 0
            assert ps["cooldownCorrectAnswer"] == q0_correct

    def test_match_timer_end_produces_finished_with_leaderboard(
        self, client: TestClient, test_container, monkeypatch
    ):
        """When match ends, room transitions to FINISHED with leaderboard."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            _sb_setup(client, ws, monkeypatch, pool_size=5)

            # Directly trigger match end (timer tested in unit tier)
            asyncio.get_event_loop().run_until_complete(
                test_container.speed_battle_handler._on_match_end(room_id)
            )
            msg = ws.receive_json()

            assert msg["roomState"]["status"] == "finished"
            assert msg["roomState"]["speedBattle"]["leaderboard"] is not None
            assert len(msg["roomState"]["speedBattle"]["leaderboard"]) == 1
            assert (
                msg["roomState"]["speedBattle"]["leaderboard"][0]["playerId"] == "Alice"
            )

    def test_r30_idempotency_double_send_dropped(
        self, client: TestClient, test_container, monkeypatch
    ):
        """Second ANSWER with same questionIndex=0 is silently dropped."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            _sb_setup(client, ws, monkeypatch, pool_size=5)

            room = test_container.room_manager.get_room(room_id)
            q0 = room.questions[0].answer

            ws.send_json({"type": "ANSWER", "answer": q0, "questionIndex": 0})
            ws.receive_json()  # advances to index=1

            # Send duplicate — same questionIndex=0, now stale
            ws.send_json({"type": "ANSWER", "answer": q0, "questionIndex": 0})

            # No broadcast expected (silent drop) — verify via container
            progress = test_container.speed_battle_handler._round_states[
                room_id
            ].per_player["Alice"]
            assert progress.current_question_index == 1
            assert progress.correct_count == 1

    def test_r30_no_question_index_dropped_in_speed_battle(
        self, client: TestClient, test_container, monkeypatch
    ):
        """ANSWER without questionIndex is silently dropped in Speed Battle (R30)."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            _sb_setup(client, ws, monkeypatch, pool_size=5)

            room = test_container.room_manager.get_room(room_id)
            ws.send_json({"type": "ANSWER", "answer": room.questions[0].answer})
            # No questionIndex — handler should silently drop

            progress = test_container.speed_battle_handler._round_states[
                room_id
            ].per_player["Alice"]
            assert progress.current_question_index == 0  # unchanged

    def test_mc_required_gate_sends_error(self, client: TestClient, monkeypatch):
        """START_GAME with speed_battle and MC off sends ERROR, stays WAITING."""
        _sb_patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 5)
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            # Set speed_battle and explicitly disable MC
            ws.send_json(
                {
                    "type": "UPDATE_CONFIG",
                    "config": {
                        "gameMode": "speed_battle",
                        "multipleChoiceEnabled": False,
                    },
                }
            )
            ws.receive_json()  # config updated (MC disabled)

            ws.send_json({"type": "START_GAME"})
            msg = ws.receive_json()

            assert msg["type"] == "ERROR"
            assert "Multiple Choice" in msg["message"]

    def test_mc_required_gate_happy_path(self, client: TestClient, monkeypatch):
        """START_GAME with speed_battle and MC on succeeds."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            msg = _sb_setup(client, ws, monkeypatch, pool_size=5)

            assert msg["roomState"]["status"] == "playing"
            assert msg["roomState"]["speedBattle"] is not None

    def test_per_recipient_privacy_two_players(
        self, client: TestClient, test_container, monkeypatch
    ):
        """Alice and Bob each receive currentQuestion for their own index only."""
        _sb_patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 10)
        room_id, tokens = _setup_room(client, ["Alice", "Bob"])

        with (
            client.websocket_connect(
                _ws_url(room_id, "Alice", tokens["Alice"])
            ) as ws_alice,
            client.websocket_connect(_ws_url(room_id, "Bob", tokens["Bob"])) as ws_bob,
        ):
            ws_alice.receive_json()  # Alice initial
            ws_bob.receive_json()  # Bob initial
            ws_alice.receive_json()  # Alice sees Bob join broadcast

            ws_alice.send_json(
                {
                    "type": "UPDATE_CONFIG",
                    "config": {
                        "gameMode": "speed_battle",
                        "multipleChoiceEnabled": True,
                    },
                }
            )
            ws_alice.receive_json()  # Alice config broadcast
            ws_bob.receive_json()  # Bob config broadcast

            ws_alice.send_json({"type": "START_GAME"})
            # Both receive per-recipient ROOM_STATE
            alice_start = ws_alice.receive_json()
            bob_start = ws_bob.receive_json()

            # Both start at questionIndex=0
            assert (
                alice_start["roomState"]["speedBattle"]["playerState"]["questionIndex"]
                == 0
            )
            assert (
                bob_start["roomState"]["speedBattle"]["playerState"]["questionIndex"]
                == 0
            )

            room = test_container.room_manager.get_room(room_id)
            # Alice answers question 0 correctly
            ws_alice.send_json(
                {
                    "type": "ANSWER",
                    "answer": room.questions[0].answer,
                    "questionIndex": 0,
                }
            )
            # Both players receive a broadcast after Alice answers
            alice_msg = ws_alice.receive_json()
            bob_msg = ws_bob.receive_json()

            # Alice now at index 1; Bob still at 0
            assert (
                alice_msg["roomState"]["speedBattle"]["playerState"]["questionIndex"]
                == 1
            )
            assert (
                bob_msg["roomState"]["speedBattle"]["playerState"]["questionIndex"] == 0
            )

            # Alice's question is for her index; Bob's question is for his index
            alice_q_text = alice_msg["roomState"]["currentQuestion"]["text"]
            bob_q_text = bob_msg["roomState"]["currentQuestion"]["text"]
            assert alice_q_text == room.questions[1].text
            assert bob_q_text == room.questions[0].text

    def test_play_again_clears_speed_battle_state(
        self, client: TestClient, test_container, monkeypatch
    ):
        """PLAY_AGAIN after Speed Battle clears round state, resets scores to 0."""
        room_id, tokens = _setup_room(client, ["Alice"])

        with client.websocket_connect(_ws_url(room_id, "Alice", tokens["Alice"])) as ws:
            ws.receive_json()
            _sb_setup(client, ws, monkeypatch, pool_size=5)

            # Trigger match end directly
            asyncio.get_event_loop().run_until_complete(
                test_container.speed_battle_handler._on_match_end(room_id)
            )
            ws.receive_json()  # FINISHED state

            ws.send_json({"type": "PLAY_AGAIN"})
            msg = ws.receive_json()

            assert msg["roomState"]["status"] == "waiting"
            assert msg["roomState"].get("speedBattle") is None
            assert msg["roomState"]["players"]["Alice"] == 0
            # Handler round state should be cleaned up
            assert room_id not in test_container.speed_battle_handler._round_states

    def test_leaderboard_tiebreaker_by_wrong_count(
        self, client: TestClient, test_container, monkeypatch
    ):
        """Player with fewer wrong answers gets placement=1 when correct counts tie."""
        _sb_patch(monkeypatch, "SPEED_BATTLE_QUESTION_POOL_SIZE", 10)
        # Long cooldown so the timer never fires during test; we call _on_cooldown_end directly
        _sb_patch(monkeypatch, "SPEED_BATTLE_WRONG_COOLDOWN_MS", 60_000)
        room_id, tokens = _setup_room(client, ["Alice", "Bob"])

        with (
            client.websocket_connect(
                _ws_url(room_id, "Alice", tokens["Alice"])
            ) as ws_alice,
            client.websocket_connect(_ws_url(room_id, "Bob", tokens["Bob"])) as ws_bob,
        ):
            ws_alice.receive_json()
            ws_bob.receive_json()
            ws_alice.receive_json()  # Bob join broadcast to Alice

            ws_alice.send_json(
                {
                    "type": "UPDATE_CONFIG",
                    "config": {
                        "gameMode": "speed_battle",
                        "multipleChoiceEnabled": True,
                    },
                }
            )
            ws_alice.receive_json()
            ws_bob.receive_json()

            ws_alice.send_json({"type": "START_GAME"})
            ws_alice.receive_json()
            ws_bob.receive_json()

            room = test_container.room_manager.get_room(room_id)

            # Alice answers correctly (0 wrong)
            ws_alice.send_json(
                {
                    "type": "ANSWER",
                    "answer": room.questions[0].answer,
                    "questionIndex": 0,
                }
            )
            ws_alice.receive_json()
            ws_bob.receive_json()

            # Bob answers wrong
            ws_bob.send_json(
                {"type": "ANSWER", "answer": "wrong_answer", "questionIndex": 0}
            )
            ws_alice.receive_json()
            ws_bob.receive_json()

            # Cancel the actual cooldown timer, then directly trigger its callback
            test_container.timer_service.cancel_player_cooldown(room_id, "Bob")
            asyncio.get_event_loop().run_until_complete(
                test_container.speed_battle_handler._on_cooldown_end(room_id, "Bob")
            )
            ws_alice.receive_json()
            ws_bob.receive_json()

            # Bob now answers correctly at index 1
            ws_bob.send_json(
                {
                    "type": "ANSWER",
                    "answer": room.questions[1].answer,
                    "questionIndex": 1,
                }
            )
            ws_alice.receive_json()
            ws_bob.receive_json()

            # Trigger match end directly
            asyncio.get_event_loop().run_until_complete(
                test_container.speed_battle_handler._on_match_end(room_id)
            )
            alice_final = ws_alice.receive_json()
            ws_bob.receive_json()

            lb = alice_final["roomState"]["speedBattle"]["leaderboard"]
            alice_row = next(r for r in lb if r["playerId"] == "Alice")
            bob_row = next(r for r in lb if r["playerId"] == "Bob")

            # Both have 1 correct; Alice has 0 wrong, Bob has 1 wrong → Alice placement=1
            assert alice_row["placement"] == 1
            assert bob_row["placement"] == 2

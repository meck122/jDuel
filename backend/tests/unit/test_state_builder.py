"""Tests for StateBuilder."""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.models import GameStatus, Room
from app.models.state import RoomConfigData
from app.services.orchestration.state_builder import StateBuilder


class TestStateBuilder:
    """Test suite for StateBuilder."""

    def test_waiting_state(self, state_builder: StateBuilder, sample_questions):
        """Waiting room has no question, no results, no winner."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"

        msg = state_builder.build_room_state(room)
        state = msg.roomState

        assert state.status == "waiting"
        assert state.currentQuestion is None
        assert state.results is None
        assert state.winner is None

    def test_playing_state_has_question_and_time(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Playing state includes the current question and a positive time remaining."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING
        room.question_index = 0
        room.question_start_time = datetime.now(UTC)

        msg = state_builder.build_room_state(room)
        state = msg.roomState

        assert state.status == "playing"
        assert state.currentQuestion is not None
        assert state.currentQuestion.text == sample_questions[0].text
        assert state.timeRemainingMs is not None
        assert state.timeRemainingMs > 0

    def test_playing_state_multiple_choice_has_4_options(
        self, state_builder: StateBuilder, sample_questions
    ):
        """When MC is enabled and question has wrong_answers, options has 4 items including the answer."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING
        room.question_index = 2  # This question has wrong_answers
        room.question_start_time = datetime.now(UTC)
        room.config.multiple_choice_enabled = True

        msg = state_builder.build_room_state(room)
        options = msg.roomState.currentQuestion.options

        assert options is not None
        assert len(options) == 4
        assert sample_questions[2].answer in options
        for wrong in sample_questions[2].wrong_answers:
            assert wrong in options

    def test_playing_state_no_wrong_answers_means_no_options(
        self, state_builder: StateBuilder, sample_questions
    ):
        """When MC is enabled but question has no wrong_answers, options is None."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING
        room.question_index = 0  # This question has no wrong_answers
        room.question_start_time = datetime.now(UTC)
        room.config.multiple_choice_enabled = True

        msg = state_builder.build_room_state(room)
        assert msg.roomState.currentQuestion.options is None

    def test_results_state_has_answer_and_player_data(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Results state includes the correct answer and player submissions."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 1000}
        room.host_id = "Alice"
        room.status = GameStatus.RESULTS
        room.question_index = 0
        room.results_start_time = datetime.now(UTC)
        room.player_answers = {"Alice": "4"}
        room.question_points = {"Alice": 1000}

        msg = state_builder.build_room_state(room)
        state = msg.roomState

        assert state.status == "results"
        assert state.results is not None
        assert state.results.correctAnswer == "4"
        assert state.results.playerAnswers == {"Alice": "4"}
        assert state.results.playerResults == {"Alice": 1000}

    def test_finished_state_has_winner(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Finished state includes the player with the highest score as winner."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice", "Bob"}
        room.scores = {"Alice": 500, "Bob": 1500}
        room.host_id = "Alice"
        room.status = GameStatus.FINISHED
        room.finish_time = datetime.now(UTC)

        msg = state_builder.build_room_state(room)
        assert msg.roomState.status == "finished"
        assert msg.roomState.winner == "Bob"

    def test_finished_state_empty_scores_no_winner(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Finished state with no scores yields no winner."""
        room = Room("TEST1", sample_questions)
        room.status = GameStatus.FINISHED
        room.finish_time = datetime.now(UTC)

        msg = state_builder.build_room_state(room)
        assert msg.roomState.winner is None

    def test_multiple_choice_options_stable_across_builds(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Calling build_room_state multiple times returns the same option order."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING
        room.question_index = 2  # Has wrong_answers
        room.question_start_time = datetime.now(UTC)
        room.config.multiple_choice_enabled = True

        msg1 = state_builder.build_room_state(room)
        msg2 = state_builder.build_room_state(room)
        msg3 = state_builder.build_room_state(room)

        assert (
            msg1.roomState.currentQuestion.options
            == msg2.roomState.currentQuestion.options
        )
        assert (
            msg2.roomState.currentQuestion.options
            == msg3.roomState.currentQuestion.options
        )

    def test_shuffled_options_cached_on_round_state(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Building room state populates shuffled_options on the room's RoundState."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING
        room.question_index = 2
        room.question_start_time = datetime.now(UTC)
        room.config.multiple_choice_enabled = True

        assert room.current_round.shuffled_options is None

        state_builder.build_room_state(room)

        assert room.current_round.shuffled_options is not None
        assert len(room.current_round.shuffled_options) == 4

    def test_shuffled_options_reset_produces_new_options(
        self, state_builder: StateBuilder, sample_questions
    ):
        """After clearing shuffled_options, new options are generated with all answers."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING
        room.question_index = 2
        room.question_start_time = datetime.now(UTC)
        room.config.multiple_choice_enabled = True

        state_builder.build_room_state(room)
        room.current_round.shuffled_options = None
        room.question_start_time = datetime.now(UTC)

        msg = state_builder.build_room_state(room)
        options = msg.roomState.currentQuestion.options

        assert options is not None
        assert len(options) == 4
        assert sample_questions[2].answer in options
        for wrong in sample_questions[2].wrong_answers:
            assert wrong in options

    def test_no_options_cached_when_mc_disabled(
        self, state_builder: StateBuilder, sample_questions
    ):
        """When multiple choice is disabled, no shuffled_options are cached."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING
        room.question_index = 2
        room.question_start_time = datetime.now(UTC)
        room.config.multiple_choice_enabled = False

        state_builder.build_room_state(room)

        assert room.current_round.shuffled_options is None


class TestRoomConfigDataGameMode:
    """Tests for RoomConfigData.gameMode field and state_builder wiring."""

    def test_default_constructs_with_classic(self):
        """RoomConfigData() default-constructs with gameMode='classic'."""
        config = RoomConfigData()
        assert config.gameMode == "classic"

    def test_explicit_speed_battle(self):
        """RoomConfigData(gameMode='speed_battle') round-trips correctly."""
        config = RoomConfigData(gameMode="speed_battle")
        dumped = config.model_dump(exclude_none=True)
        assert dumped["gameMode"] == "speed_battle"

    def test_invalid_game_mode_raises(self):
        """RoomConfigData(gameMode='garbage') raises ValidationError."""
        with pytest.raises(ValidationError):
            RoomConfigData(gameMode="garbage")

    def test_state_builder_wires_speed_battle(
        self, state_builder: StateBuilder, sample_questions
    ):
        """state_builder.build_room_state reflects game_mode='speed_battle'."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.config.game_mode = "speed_battle"

        msg = state_builder.build_room_state(room)
        assert msg.roomState.config.gameMode == "speed_battle"

    def test_state_builder_default_game_mode_is_classic(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Fresh room produces ROOM_STATE with config.gameMode=='classic'."""
        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"

        msg = state_builder.build_room_state(room)
        assert msg.roomState.config.gameMode == "classic"


class TestBuildSpeedBattleStateForPlayer:
    """Tests for StateBuilder.build_speed_battle_state_for_player."""

    def _make_round_state(self):
        import asyncio

        from app.services.orchestration.speed_battle_handler import (
            PlayerProgress,
            SpeedBattleRoundState,
        )

        now = asyncio.get_event_loop().time()
        round_state = SpeedBattleRoundState(
            match_start_monotonic=now,
            match_end_monotonic=now + 180,
            match_start_wall=datetime.now(UTC),
        )
        round_state.per_player["Alice"] = PlayerProgress(
            current_question_index=3, correct_count=3, wrong_count=0
        )
        return round_state

    def test_playing_room_includes_current_question(
        self, state_builder: StateBuilder, sample_questions
    ):
        """PLAYING state includes Alice's per-recipient currentQuestion."""

        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 3}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING
        room.config.multiple_choice_enabled = True

        round_state = self._make_round_state()
        progress = round_state.per_player["Alice"]

        msg = state_builder.build_speed_battle_state_for_player(
            room, "Alice", round_state, progress, match_remaining_ms=120_000
        )

        assert msg.roomState.status == "playing"
        assert msg.roomState.currentQuestion is not None
        assert msg.roomState.speedBattle is not None
        assert msg.roomState.speedBattle.matchRemainingMs == 120_000
        assert msg.roomState.speedBattle.leaderboard is None
        assert msg.roomState.speedBattle.playerState.questionIndex == 3

    def test_finished_room_includes_leaderboard(
        self, state_builder: StateBuilder, sample_questions
    ):
        """FINISHED state has leaderboard, matchRemainingMs=0, currentQuestion=None."""
        from app.models.state import SpeedBattleLeaderRow

        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 3}
        room.host_id = "Alice"
        room.status = GameStatus.FINISHED

        round_state = self._make_round_state()
        progress = round_state.per_player["Alice"]
        leaderboard = [
            SpeedBattleLeaderRow(
                playerId="Alice", correctCount=3, wrongCount=0, placement=1
            )
        ]

        msg = state_builder.build_speed_battle_state_for_player(
            room,
            "Alice",
            round_state,
            progress,
            match_remaining_ms=0,
            leaderboard=leaderboard,
        )

        assert msg.roomState.status == "finished"
        assert msg.roomState.currentQuestion is None
        assert msg.roomState.speedBattle.matchRemainingMs == 0
        assert len(msg.roomState.speedBattle.leaderboard) == 1

    def test_exhausted_player_has_no_current_question(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Exhausted player has currentQuestion=None even while PLAYING."""

        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 5}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING

        round_state = self._make_round_state()
        round_state.per_player["Alice"].exhausted = True
        progress = round_state.per_player["Alice"]

        msg = state_builder.build_speed_battle_state_for_player(
            room, "Alice", round_state, progress, match_remaining_ms=60_000
        )

        assert msg.roomState.currentQuestion is None
        assert msg.roomState.speedBattle.playerState.exhausted is True

    def test_cooldown_player_state_includes_reveal(
        self, state_builder: StateBuilder, sample_questions
    ):
        """Player in cooldown has cooldownRemainingMs and cooldownCorrectAnswer."""
        import asyncio

        room = Room("TEST1", sample_questions)
        room.players = {"Alice"}
        room.scores = {"Alice": 0}
        room.host_id = "Alice"
        room.status = GameStatus.PLAYING

        round_state = self._make_round_state()
        now_mono = asyncio.get_event_loop().time()
        round_state.per_player["Alice"].cooldown_expires_at_monotonic = now_mono + 3
        round_state.per_player["Alice"].revealed_correct_answer = "Paris"
        progress = round_state.per_player["Alice"]

        msg = state_builder.build_speed_battle_state_for_player(
            room, "Alice", round_state, progress, match_remaining_ms=60_000
        )

        ps = msg.roomState.speedBattle.playerState
        assert ps.cooldownRemainingMs is not None
        assert ps.cooldownRemainingMs > 0
        assert ps.cooldownCorrectAnswer == "Paris"

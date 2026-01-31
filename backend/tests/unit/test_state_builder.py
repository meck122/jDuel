"""Tests for StateBuilder."""

from datetime import UTC, datetime

from app.models import GameStatus, Room
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

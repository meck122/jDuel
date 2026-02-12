"""Tests for GameService."""

from app.models import GameStatus, Room


class TestGameService:
    """Test suite for GameService."""

    def test_start_game(self, game_service, sample_questions):
        """Test starting a game initializes state correctly."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1", "player2"}
        room.scores = {"player1": 0, "player2": 0}

        game_service.start_game(room)

        assert room.status == GameStatus.PLAYING
        assert room.question_index == 0
        assert room.question_start_time is not None
        assert len(room.answered_players) == 0
        assert len(room.player_answers) == 0

    def test_process_correct_answer(self, game_service, sample_questions):
        """Test processing a correct answer awards points."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}
        game_service.start_game(room)

        result = game_service.process_answer(room, "player1", "4")

        assert result is True
        assert "player1" in room.answered_players
        assert "player1" in room.correct_players
        assert room.scores["player1"] > 0

    def test_process_incorrect_answer(self, game_service, sample_questions):
        """Test processing an incorrect answer awards no points."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}
        game_service.start_game(room)

        result = game_service.process_answer(room, "player1", "wrong")

        assert result is False
        assert "player1" in room.answered_players
        assert "player1" not in room.correct_players
        assert room.scores["player1"] == 0

    def test_duplicate_answer_ignored(self, game_service, sample_questions):
        """Test that duplicate answers are ignored."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}
        game_service.start_game(room)

        game_service.process_answer(room, "player1", "4")
        initial_score = room.scores["player1"]

        # Second answer should be ignored
        result = game_service.process_answer(room, "player1", "4")

        assert result is False
        assert room.scores["player1"] == initial_score

    def test_all_players_answered(self, game_service, sample_questions):
        """Test detecting when all players have answered."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1", "player2"}
        room.scores = {"player1": 0, "player2": 0}
        game_service.start_game(room)

        assert game_service.all_players_answered(room) is False

        game_service.process_answer(room, "player1", "4")
        assert game_service.all_players_answered(room) is False

        game_service.process_answer(room, "player2", "5")
        assert game_service.all_players_answered(room) is True

    def test_advance_question(self, game_service, sample_questions):
        """Test advancing to the next question."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}
        game_service.start_game(room)

        has_next = game_service.advance_question(room)

        assert has_next is True
        assert room.question_index == 1
        assert len(room.answered_players) == 0
        assert room.status == GameStatus.PLAYING

    def test_advance_question_game_finished(self, game_service, sample_questions):
        """Test game finishes when no more questions."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}
        game_service.start_game(room)

        # Advance through all questions
        for _ in range(len(sample_questions)):
            game_service.advance_question(room)

        assert room.status == GameStatus.FINISHED
        assert room.finish_time is not None

    def test_show_results(self, game_service, sample_questions):
        """Test transitioning to results state."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}
        game_service.start_game(room)

        game_service.show_results(room)

        assert room.status == GameStatus.RESULTS
        assert room.results_start_time is not None

    def test_get_winner(self, game_service, sample_questions):
        """Test determining the winner."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1", "player2"}
        room.scores = {"player1": 100, "player2": 200}

        winner = game_service.get_winner(room)

        assert winner == "player2"

    def test_get_winner_no_players(self, game_service, sample_questions):
        """Test winner determination with no players."""
        room = Room("TEST1", sample_questions)

        winner = game_service.get_winner(room)

        assert winner is None

    def test_score_calculation_first_correct(self, game_service, sample_questions):
        """Test first correct answer gets maximum points."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1", "player2"}
        room.scores = {"player1": 0, "player2": 0}
        game_service.start_game(room)

        game_service.process_answer(room, "player1", "4")

        # First correct answer should get 1000 points (MAX_SCORE_PER_QUESTION)
        assert room.question_points["player1"] == 1000

    def test_score_calculation_second_correct(self, game_service, sample_questions):
        """Test second correct answer gets half points."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1", "player2"}
        room.scores = {"player1": 0, "player2": 0}
        game_service.start_game(room)

        game_service.process_answer(room, "player1", "4")
        game_service.process_answer(room, "player2", "4")

        # Second correct answer should get 500 points
        assert room.question_points["player2"] == 500

    def test_advance_question_clears_shuffled_options(
        self, game_service, sample_questions
    ):
        """Advancing to the next question resets shuffled_options."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}
        game_service.start_game(room)

        room.current_round.shuffled_options = ["A", "B", "C", "D"]

        game_service.advance_question(room)

        assert room.current_round.shuffled_options is None

    def test_start_game_clears_shuffled_options(self, game_service, sample_questions):
        """Starting a game resets shuffled_options."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}

        room.current_round.shuffled_options = ["A", "B", "C", "D"]

        game_service.start_game(room)

        assert room.current_round.shuffled_options is None

    def test_reset_game_state_resets_all_fields(self, game_service, sample_questions):
        """reset_game_state resets all game fields to lobby state."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1", "player2"}
        room.scores = {"player1": 500, "player2": 1000}

        # Simulate a completed game
        game_service.start_game(room)
        game_service.process_answer(room, "player1", "4")
        game_service.show_results(room)
        for _ in range(len(sample_questions)):
            game_service.advance_question(room)

        assert room.status == GameStatus.FINISHED
        assert room.finish_time is not None

        game_service.reset_game_state(room)

        assert room.status == GameStatus.WAITING
        assert room.question_index == 0
        assert room.questions == []
        assert room.scores == {"player1": 0, "player2": 0}
        assert room.current_round.answered_players == set()
        assert room.current_round.player_answers == {}
        assert room.current_round.correct_players == set()
        assert room.current_round.question_points == {}
        assert room.current_round.shuffled_options is None
        assert room.finish_time is None
        assert room.results_start_time is None
        assert room.last_reaction_times == {}

    def test_reset_game_state_preserves_config(self, game_service, sample_questions):
        """reset_game_state preserves room config."""
        room = Room("TEST1", sample_questions)
        room.players = {"player1"}
        room.scores = {"player1": 0}
        room.config.difficulty = "beast"
        room.config.multiple_choice_enabled = True

        game_service.start_game(room)
        game_service.reset_game_state(room)

        assert room.config.difficulty == "beast"
        assert room.config.multiple_choice_enabled is True

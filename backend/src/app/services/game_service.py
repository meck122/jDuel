"""Game logic service for handling game rules and scoring."""

from datetime import UTC, datetime

from app.config import MAX_SCORE_PER_QUESTION, QUESTION_TIME_MS
from app.models import GameStatus, Room


class GameService:
    """Handles game rules, scoring, and progression logic."""

    def calculate_score(self, time_taken_ms: int) -> int:
        """Calculate score based on answer speed.

        Args:
            time_taken_ms: Time taken to answer in milliseconds

        Returns:
            Score value between 0 and MAX_SCORE_PER_QUESTION
        """
        if time_taken_ms > QUESTION_TIME_MS:
            return 0
        return max(0, MAX_SCORE_PER_QUESTION - (time_taken_ms // 10))

    def is_answer_correct(self, user_answer: str, correct_answer: str) -> bool:
        """Check if answer is correct (case-insensitive, trimmed).

        Args:
            user_answer: The player's submitted answer
            correct_answer: The correct answer

        Returns:
            True if answers match, False otherwise
        """
        return user_answer.strip().lower() == correct_answer.strip().lower()

    def process_answer(self, room: Room, player_id: str, answer: str) -> bool:
        """Process a player's answer and update their score.

        Args:
            room: The game room
            player_id: The player submitting the answer
            answer: The submitted answer

        Returns:
            True if answer is correct, False otherwise
        """
        # Prevent duplicate answers
        if player_id in room.answered_players:
            return False

        room.answered_players.add(player_id)
        room.player_answers[player_id] = answer

        current_question = room.questions[room.question_index]
        correct = self.is_answer_correct(answer, current_question.answer)

        if correct:
            # Calculate time on server side for security
            elapsed_ms = int(
                (datetime.now(UTC) - room.question_start_time).total_seconds() * 1000
            )

            # Validate time is within bounds
            if elapsed_ms <= QUESTION_TIME_MS:
                score = self.calculate_score(elapsed_ms)
                room.scores[player_id] += score

        return correct

    def all_players_answered(self, room: Room) -> bool:
        """Check if all players have answered.

        Args:
            room: The game room

        Returns:
            True if all players have answered, False otherwise
        """
        return len(room.answered_players) == len(room.players)

    def advance_question(self, room: Room) -> bool:
        """Move to next question.

        Args:
            room: The game room

        Returns:
            True if more questions exist, False if game is finished
        """
        room.question_index += 1
        room.answered_players = set()
        room.player_answers = {}

        if room.question_index >= len(room.questions):
            room.status = GameStatus.FINISHED
            room.finish_time = datetime.now(UTC)
            return False

        room.status = GameStatus.PLAYING
        room.question_start_time = datetime.now(UTC)
        return True

    def start_game(self, room: Room) -> None:
        """Initialize game state for a room.

        Args:
            room: The game room to start
        """
        room.status = GameStatus.PLAYING
        room.question_index = 0
        room.question_start_time = datetime.now(UTC)
        room.answered_players = set()
        room.player_answers = {}

        # Reset all scores
        for player_id in room.scores:
            room.scores[player_id] = 0

    def show_results(self, room: Room) -> None:
        """Transition room to results screen.

        Args:
            room: The game room
        """
        room.status = GameStatus.RESULTS
        room.results_start_time = datetime.now(UTC)

    def get_winner(self, room: Room) -> str | None:
        """Get the winner of the game.

        Args:
            room: The game room

        Returns:
            Player ID of the winner, or None if no players
        """
        if not room.scores:
            return None
        return max(room.scores.items(), key=lambda x: x[1])[0]

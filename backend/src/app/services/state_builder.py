"""Builds room state for client communication."""

from datetime import UTC, datetime

from app.config import GAME_OVER_TIME_MS, QUESTION_TIME_MS, RESULTS_TIME_MS
from app.models import GameStatus, Room


class StateBuilder:
    """Builds room state dictionaries for WebSocket messages."""

    def build_room_state(self, room: Room) -> dict:
        """Build complete room state for broadcasting.

        Args:
            room: The game room

        Returns:
            Dictionary containing room state for clients
        """
        state = {
            "type": "ROOM_STATE",
            "roomState": {
                "players": room.scores,
                "status": room.status.value,
                "questionIndex": room.question_index,
            },
        }

        if room.status == GameStatus.PLAYING:
            self._add_playing_state(state, room)
        elif room.status == GameStatus.RESULTS:
            self._add_results_state(state, room)
        elif room.status == GameStatus.FINISHED:
            self._add_finished_state(state, room)

        return state

    def _add_playing_state(self, state: dict, room: Room) -> None:
        """Add playing state details.

        Args:
            state: The state dictionary to modify
            room: The game room
        """
        current_question = room.questions[room.question_index]
        elapsed = (datetime.now(UTC) - room.question_start_time).total_seconds() * 1000
        time_remaining = max(0, QUESTION_TIME_MS - int(elapsed))

        state["roomState"]["currentQuestion"] = {
            "text": current_question["text"],
            "category": current_question["category"],
        }
        state["roomState"]["timeRemainingMs"] = time_remaining

    def _add_results_state(self, state: dict, room: Room) -> None:
        """Add results state details.

        Args:
            state: The state dictionary to modify
            room: The game room
        """
        # Show results from current question
        current_question = room.questions[room.question_index]
        elapsed = (datetime.now(UTC) - room.results_start_time).total_seconds() * 1000
        time_remaining = max(0, RESULTS_TIME_MS - int(elapsed))

        state["roomState"]["results"] = {
            "correctAnswer": current_question["answer"],
            "playerAnswers": room.player_answers,
        }
        state["roomState"]["timeRemainingMs"] = time_remaining

    def _add_finished_state(self, state: dict, room: Room) -> None:
        """Add finished state details.

        Args:
            state: The state dictionary to modify
            room: The game room
        """
        # Show final results
        winner = (
            max(room.scores.items(), key=lambda x: x[1])[0] if room.scores else None
        )
        state["roomState"]["winner"] = winner

        # Include time until room closes if we have a finish time
        if hasattr(room, "finish_time") and room.finish_time:
            elapsed = (datetime.now(UTC) - room.finish_time).total_seconds() * 1000
            time_remaining = max(0, GAME_OVER_TIME_MS - int(elapsed))
            state["roomState"]["timeRemainingMs"] = time_remaining

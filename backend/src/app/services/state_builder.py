"""Builds room state for client communication."""

from app.config import GAME_OVER_TIME_MS, QUESTION_TIME_MS, RESULTS_TIME_MS
from app.models import GameStatus, Room
from app.models.state import (
    CurrentQuestion,
    ResultsData,
    RoomStateData,
    RoomStateMessage,
)


class StateBuilder:
    """Builds room state dictionaries for WebSocket messages."""

    def build_room_state(self, room: Room) -> RoomStateMessage:
        """Build complete room state for broadcasting.

        Args:
            room: The game room

        Returns:
            Typed room state message for clients
        """
        state_data = RoomStateData(
            roomId=room.room_id,
            players=room.scores,
            status=room.status.value,
            questionIndex=room.question_index,
        )

        if room.status == GameStatus.PLAYING:
            self._add_playing_state(state_data, room)
        elif room.status == GameStatus.RESULTS:
            self._add_results_state(state_data, room)
        elif room.status == GameStatus.FINISHED:
            self._add_finished_state(state_data, room)

        return RoomStateMessage(roomState=state_data)

    def _add_playing_state(self, state: RoomStateData, room: Room) -> None:
        """Add playing state details.

        Args:
            state: The state data to modify
            room: The game room
        """
        current_question = room.questions[room.question_index]

        state.currentQuestion = CurrentQuestion(
            text=current_question.text,
            category=current_question.category,
        )

        # if a player disconnected this same time will be sent...
        # BUT it's ok because the prop doesn't update and the component does not re-rerender
        state.timeRemainingMs = QUESTION_TIME_MS

    def _add_results_state(self, state: RoomStateData, room: Room) -> None:
        """Add results state details.

        Args:
            state: The state data to modify
            room: The game room
        """
        current_question = room.questions[room.question_index]

        state.results = ResultsData(
            correctAnswer=current_question.answer,
            playerAnswers=room.player_answers,
            playerResults=room.question_points,
        )
        state.timeRemainingMs = RESULTS_TIME_MS

    def _add_finished_state(self, state: RoomStateData, room: Room) -> None:
        """Add finished state details.

        Args:
            state: The state data to modify
            room: The game room
        """
        state.winner = (
            max(room.scores.items(), key=lambda x: x[1])[0] if room.scores else None
        )

        if room.finish_time:
            state.timeRemainingMs = GAME_OVER_TIME_MS

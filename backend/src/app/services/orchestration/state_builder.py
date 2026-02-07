"""Builds room state for client communication."""

import logging
import random
from datetime import UTC, datetime

from app.config import GAME_OVER_TIME_MS, QUESTION_TIME_MS, REACTIONS, RESULTS_TIME_MS
from app.models import GameStatus, Room
from app.models.state import (
    CurrentQuestion,
    ReactionData,
    ResultsData,
    RoomConfigData,
    RoomStateData,
    RoomStateMessage,
)

logger = logging.getLogger(__name__)


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
            totalQuestions=len(room.questions),
            hostId=room.host_id,
            config=RoomConfigData(
                multipleChoiceEnabled=room.config.multiple_choice_enabled,
                difficulty=room.config.difficulty,
            ),
            reactions=[ReactionData(id=r["id"], label=r["label"]) for r in REACTIONS],
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
        if room.question_index >= len(room.questions):
            logger.error(
                f"question_index {room.question_index} out of bounds "
                f"for {len(room.questions)} questions in room {room.room_id}"
            )
            return

        current_question = room.questions[room.question_index]

        options = None
        if room.config.multiple_choice_enabled and current_question.wrong_answers:
            if room.current_round.shuffled_options is None:
                options = [current_question.answer, *current_question.wrong_answers]
                random.shuffle(options)
                room.current_round.shuffled_options = options
            else:
                options = room.current_round.shuffled_options

        state.currentQuestion = CurrentQuestion(
            text=current_question.text,
            category=current_question.category,
            options=options,
        )

        # Calculate live remaining time for reconnecting players
        if room.question_start_time:
            elapsed_ms = int(
                (datetime.now(UTC) - room.question_start_time).total_seconds() * 1000
            )
            state.timeRemainingMs = max(0, QUESTION_TIME_MS - elapsed_ms)
        else:
            state.timeRemainingMs = QUESTION_TIME_MS

    def _add_results_state(self, state: RoomStateData, room: Room) -> None:
        """Add results state details.

        Args:
            state: The state data to modify
            room: The game room
        """
        if room.question_index >= len(room.questions):
            logger.error(
                f"question_index {room.question_index} out of bounds "
                f"for {len(room.questions)} questions in room {room.room_id}"
            )
            return

        current_question = room.questions[room.question_index]

        state.results = ResultsData(
            correctAnswer=current_question.answer,
            playerAnswers=room.player_answers,
            playerResults=room.question_points,
        )

        # Calculate live remaining time for reconnecting players
        if room.results_start_time:
            elapsed_ms = int(
                (datetime.now(UTC) - room.results_start_time).total_seconds() * 1000
            )
            state.timeRemainingMs = max(0, RESULTS_TIME_MS - elapsed_ms)
        else:
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

        # Calculate live remaining time for reconnecting players
        if room.finish_time:
            elapsed_ms = int(
                (datetime.now(UTC) - room.finish_time).total_seconds() * 1000
            )
            state.timeRemainingMs = max(0, GAME_OVER_TIME_MS - elapsed_ms)
        else:
            state.timeRemainingMs = GAME_OVER_TIME_MS

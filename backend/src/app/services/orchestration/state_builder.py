"""Builds room state for client communication."""

from __future__ import annotations

import logging
import random
import time
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.config import GAME_OVER_TIME_MS, QUESTION_TIME_MS, REACTIONS, RESULTS_TIME_MS
from app.models import GameStatus, Room
from app.models.state import (
    CurrentQuestion,
    ReactionData,
    ResultsData,
    RoomConfigData,
    RoomStateData,
    RoomStateMessage,
    SpeedBattleLeaderRow,
    SpeedBattlePlayerState,
    SpeedBattleStateData,
)

if TYPE_CHECKING:
    from app.services.orchestration.speed_battle_handler import (
        PlayerProgress,
        SpeedBattleRoundState,
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
                gameMode=room.config.game_mode,
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

    def build_speed_battle_state_for_player(
        self,
        room: Room,
        player_id: str,
        round_state: SpeedBattleRoundState,
        player_progress: PlayerProgress,
        match_remaining_ms: int | None = None,
        leaderboard: list[SpeedBattleLeaderRow] | None = None,
        scores_override: dict[str, int] | None = None,
    ) -> RoomStateMessage:
        """Build a per-recipient Speed Battle ROOM_STATE message.

        The caller pre-computes match_remaining_ms and leaderboard once and
        passes them in so the closure in the handler doesn't recompute per player.

        Args:
            room: The game room
            player_id: The recipient player
            round_state: Current Speed Battle round state
            player_progress: The recipient's PlayerProgress
            match_remaining_ms: Pre-computed remaining milliseconds (or None to compute now)
            leaderboard: Pre-computed final leaderboard rows (None mid-round)
            scores_override: Snapshot of scores to use instead of room.scores
                (lets the per-recipient closure freeze scores under the lock
                so peer mutations between sends do not leak into later recipients)
        """
        if match_remaining_ms is None:
            if round_state.ended:
                match_remaining_ms = 0
            else:
                match_remaining_ms = int(
                    max(
                        0,
                        (round_state.match_end_monotonic - time.monotonic()) * 1000,
                    )
                )

        scores_view = scores_override if scores_override is not None else room.scores
        state_data = RoomStateData(
            roomId=room.room_id,
            players=scores_view,
            status=room.status.value,
            questionIndex=0,
            totalQuestions=len(room.questions),
            hostId=room.host_id,
            config=RoomConfigData(
                multipleChoiceEnabled=room.config.multiple_choice_enabled,
                difficulty=room.config.difficulty,
                gameMode=room.config.game_mode,
            ),
            reactions=[ReactionData(id=r["id"], label=r["label"]) for r in REACTIONS],
        )

        # Compute cooldown remaining for this player
        cooldown_remaining_ms: int | None = None
        if player_progress.cooldown_expires_at_monotonic is not None:
            remaining = player_progress.cooldown_expires_at_monotonic - time.monotonic()
            cooldown_remaining_ms = int(max(0, remaining * 1000))

        player_state = SpeedBattlePlayerState(
            questionIndex=player_progress.current_question_index,
            correctCount=player_progress.correct_count,
            wrongCount=player_progress.wrong_count,
            cooldownRemainingMs=cooldown_remaining_ms,
            cooldownCorrectAnswer=player_progress.revealed_correct_answer,
            exhausted=player_progress.exhausted,
        )

        if room.status == GameStatus.PLAYING:
            # Per-recipient currentQuestion (private — never shared with other players)
            if (
                not player_progress.exhausted
                and player_progress.current_question_index < len(room.questions)
            ):
                q = room.questions[player_progress.current_question_index]
                options: list[str] | None = None
                if room.config.multiple_choice_enabled and q.wrong_answers:
                    # Use cached shuffled options when present and matching
                    # the current question index. The handler is responsible
                    # for populating / invalidating the cache under room.lock
                    # before invoking this builder so per-recipient broadcasts
                    # within the same question return identical option order.
                    cached = player_progress.shuffled_options
                    cached_idx = player_progress.shuffled_options_question_index
                    if (
                        cached is not None
                        and cached_idx == player_progress.current_question_index
                    ):
                        options = cached
                    else:
                        options = [q.answer, *q.wrong_answers]
                        random.shuffle(options)
                state_data.currentQuestion = CurrentQuestion(
                    text=q.text, category=q.category, options=options
                )

            state_data.speedBattle = SpeedBattleStateData(
                matchRemainingMs=match_remaining_ms,
                playerState=player_state,
            )

        elif room.status == GameStatus.FINISHED:
            state_data.speedBattle = SpeedBattleStateData(
                matchRemainingMs=0,
                playerState=player_state,
                leaderboard=leaderboard,
            )
            if room.finish_time:
                elapsed_ms = int(
                    (datetime.now(UTC) - room.finish_time).total_seconds() * 1000
                )
                state_data.timeRemainingMs = max(0, GAME_OVER_TIME_MS - elapsed_ms)
            else:
                state_data.timeRemainingMs = GAME_OVER_TIME_MS

        return RoomStateMessage(roomState=state_data)

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

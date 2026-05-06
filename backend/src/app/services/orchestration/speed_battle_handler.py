"""Speed Battle game handler — owns per-room/per-player Speed Battle state."""

from __future__ import annotations

import copy
import logging
import random
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.config.game import (
    SPEED_BATTLE_MATCH_TIME_MS,
    SPEED_BATTLE_QUESTION_POOL_SIZE,
    SPEED_BATTLE_WRONG_COOLDOWN_MS,
)
from app.models import GameStatus
from app.models.state import SpeedBattleLeaderRow

if TYPE_CHECKING:
    from app.models import Room
    from app.services.core import RoomManager, TimerService
    from app.services.orchestration.protocols import GameOverTimerStarter, RoomCloser
    from app.services.orchestration.state_builder import StateBuilder

logger = logging.getLogger(__name__)


@dataclass
class PlayerProgress:
    current_question_index: int = 0
    correct_count: int = 0
    wrong_count: int = 0
    cooldown_expires_at_monotonic: float | None = None
    revealed_correct_answer: str | None = None
    exhausted: bool = False
    # Cache of shuffled MC options keyed by question_index, mirroring the
    # Classic mode pattern (room.current_round.shuffled_options). Without
    # this cache the per-recipient broadcast re-shuffles options on every
    # peer answer / cooldown_end / reconnect, causing the recipient's
    # display to reorder mid-question.
    shuffled_options: list[str] | None = None
    shuffled_options_question_index: int | None = None


@dataclass
class SpeedBattleRoundState:
    match_start_monotonic: float
    match_end_monotonic: float
    match_start_wall: datetime  # for log readability only (not used for timing)
    per_player: dict[str, PlayerProgress] = field(default_factory=dict)
    ended: bool = False


class SpeedBattleHandler:
    """Owns Speed Battle per-room and per-player state and game loop.

    Classic mode logic is completely untouched — the orchestrator delegates
    here only when room.config.game_mode == "speed_battle".
    """

    def __init__(
        self,
        room_manager: RoomManager,
        timer_service: TimerService,
        state_builder: StateBuilder,
        room_closer: RoomCloser,
    ) -> None:
        self._room_manager = room_manager
        self._timer_service = timer_service
        self._state_builder = state_builder
        self._room_closer = room_closer
        self._orchestrator: GameOverTimerStarter | None = None
        self._round_states: dict[str, SpeedBattleRoundState] = {}

    def set_orchestrator(self, orchestrator: GameOverTimerStarter) -> None:
        """Bind the orchestrator reference for start_game_over_timer callbacks."""
        self._orchestrator = orchestrator

    # ------------------------------------------------------------------
    # Public API called by the orchestrator
    # ------------------------------------------------------------------

    async def start_match(self, room: Room) -> None:
        """Initialize round state and start the match timer.

        The orchestrator holds room.lock for the full start_game path; this
        method must NOT re-acquire it.
        """
        if self._orchestrator is None:
            raise RuntimeError(
                "SpeedBattleHandler not bound to orchestrator — "
                "call set_orchestrator() before starting a match"
            )

        now_mono = time.monotonic()
        round_state = SpeedBattleRoundState(
            match_start_monotonic=now_mono,
            match_end_monotonic=now_mono + SPEED_BATTLE_MATCH_TIME_MS / 1000,
            match_start_wall=datetime.now(UTC),
        )
        for player_id in room.players:
            round_state.per_player[player_id] = PlayerProgress()

        # Authoritative correct-count mirror in room.scores (Decision § 6)
        room.scores = {pid: 0 for pid in room.players}

        self._round_states[room.room_id] = round_state

        self._timer_service.start_match_timer(
            room.room_id,
            SPEED_BATTLE_MATCH_TIME_MS,
            lambda: self._on_match_end(room.room_id),
        )
        logger.info(
            f"Speed Battle match started: room_id={room.room_id}, "
            f"players={list(room.players)}"
        )

    async def handle_answer(
        self,
        room: Room,
        player_id: str,
        answer: str,
        question_index: int | None,
    ) -> None:
        """Process an ANSWER message under room.lock (MC-only, sub-µs, Decision § 3)."""
        build_state_closure: Callable[[str], dict] | None = None

        async with room.lock:
            round_state = self._round_states.get(room.room_id)
            if round_state is None or round_state.ended:
                return  # silent drop

            progress = round_state.per_player.get(player_id)
            if progress is None or progress.exhausted:
                return  # silent drop

            now_mono = time.monotonic()

            # R30 idempotency: drop if match deadline has passed (R11a)
            if now_mono >= round_state.match_end_monotonic:
                return  # silent drop — server is authoritative on T=180s

            # R30 idempotency: drop if player is in cooldown
            if (
                progress.cooldown_expires_at_monotonic is not None
                and progress.cooldown_expires_at_monotonic > now_mono
            ):
                return  # silent drop

            # R30 idempotency: drop if questionIndex missing or stale
            if (
                question_index is None
                or question_index != progress.current_question_index
            ):
                return  # silent drop

            question = room.questions[progress.current_question_index]
            correct = (
                answer == question.answer
            )  # MC-only sync comparison (Decision § 15)

            if correct:
                self._set_correct_count(
                    room, round_state, player_id, progress.correct_count + 1
                )
                progress.current_question_index += 1
                if progress.current_question_index >= SPEED_BATTLE_QUESTION_POOL_SIZE:
                    progress.exhausted = True
                    logger.info(
                        f"Player exhausted all questions: "
                        f"room_id={room.room_id}, player_id={player_id}"
                    )
            else:
                progress.wrong_count += 1
                progress.cooldown_expires_at_monotonic = (
                    now_mono + SPEED_BATTLE_WRONG_COOLDOWN_MS / 1000
                )
                progress.revealed_correct_answer = question.answer
                _rid = room.room_id
                _pid = player_id

                async def _cooldown_cb(_rid: str = _rid, _pid: str = _pid) -> None:
                    await self._on_cooldown_end(_rid, _pid)

                self._timer_service.start_player_cooldown(
                    room.room_id,
                    player_id,
                    SPEED_BATTLE_WRONG_COOLDOWN_MS,
                    _cooldown_cb,
                )

            build_state_closure = self._make_per_recipient_closure(room, round_state)

        if build_state_closure is not None:
            await self._room_manager.broadcast_state_per_recipient(
                room.room_id, build_state_closure
            )

    async def handle_connect(self, room: Room, player_id: str) -> None:
        """Send a single per-recipient snapshot to a reconnecting player (R24a).

        Precondition: the orchestrator has already attached the WebSocket;
        room.connections[player_id] exists.
        """
        snapshot_dict: dict | None = None

        async with room.lock:
            round_state = self._round_states.get(room.room_id)
            if round_state is None:
                return

            progress = round_state.per_player.get(player_id)
            if progress is None:
                return

            self._refresh_shuffled_options(room, progress)
            snapshot = self._state_builder.build_speed_battle_state_for_player(
                room, player_id, round_state, progress
            )
            snapshot_dict = snapshot.to_dict()

        if snapshot_dict is not None:
            await self._room_manager.send_to_player_state(
                room.room_id, player_id, snapshot_dict
            )

    def cleanup_room(self, room_id: str) -> None:
        """Drop round state for a room (called on disconnect-last and play-again)."""
        self._round_states.pop(room_id, None)

    def build_per_recipient_closure(self, room: Room) -> Callable[[str], dict]:
        """Return a per-recipient state closure using the current round state.

        Called by the orchestrator while holding room.lock, so the round state
        is guaranteed to exist (start_match was just called).
        """
        round_state = self._round_states[room.room_id]
        return self._make_per_recipient_closure(room, round_state)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _on_match_end(self, room_id: str) -> None:
        """Match timer callback — hard cut at T=180s (R11)."""
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        build_state_closure: Callable[[str], dict] | None = None

        async with room.lock:
            round_state = self._round_states.get(room_id)
            if round_state is None or round_state.ended:
                return

            round_state.ended = True
            # Cancel all in-flight per-player cooldowns (R11b).
            # NOTE: We deliberately do not call cancel_all_timers_for_room here —
            # that would cancel the match timer task we are currently running on,
            # raising CancelledError at the next await checkpoint and aborting
            # the FINISHED broadcast / start_game_over_timer scheduling below.
            self._timer_service.cancel_all_player_cooldowns_for_room(room_id)

            room.status = GameStatus.FINISHED

            logger.info(
                f"Speed Battle match ended: room_id={room_id}, "
                f"scores={dict(room.scores)}"
            )
            build_state_closure = self._make_per_recipient_closure(room, round_state)

        if build_state_closure is not None:
            await self._room_manager.broadcast_state_per_recipient(
                room_id, build_state_closure
            )

        try:
            self._orchestrator.start_game_over_timer(room_id)  # type: ignore[union-attr]
        except Exception:
            logger.exception(
                f"start_game_over_timer raised — falling back to direct close: "
                f"room_id={room_id}"
            )
            # Re-fetch and lock-wrap to mirror orchestrator._on_game_over_timeout
            # so a concurrent handle_disconnect cannot race a double delete /
            # invert ROOM_CLOSED relative to FINISHED.
            fallback_room = self._room_manager.get_room(room_id)
            if fallback_room is None:
                return
            async with fallback_room.lock:
                await self._room_closer.close_room(room_id)

    async def _on_cooldown_end(self, room_id: str, player_id: str) -> None:
        """Cooldown timer callback — auto-advance player to next question (R9)."""
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        build_state_closure: Callable[[str], dict] | None = None

        async with room.lock:
            # Re-fetch under lock — the room may have been torn down while this
            # callback was queued behind the lock (mirrors
            # orchestrator._on_question_timeout).
            current_room = self._room_manager.get_room(room_id)
            if current_room is None or current_room.status != GameStatus.PLAYING:
                return

            round_state = self._round_states.get(room_id)
            if round_state is None or round_state.ended:
                return  # match ended while cooldown was in flight

            progress = round_state.per_player.get(player_id)
            if progress is None:
                return

            # Advance past the wrong question
            progress.current_question_index += 1
            progress.cooldown_expires_at_monotonic = None
            progress.revealed_correct_answer = None

            if progress.current_question_index >= SPEED_BATTLE_QUESTION_POOL_SIZE:
                progress.exhausted = True

            build_state_closure = self._make_per_recipient_closure(room, round_state)

        if build_state_closure is not None:
            await self._room_manager.broadcast_state_per_recipient(
                room_id, build_state_closure
            )

    def _set_correct_count(
        self,
        room: Room,
        round_state: SpeedBattleRoundState,
        player_id: str,
        new_count: int,
    ) -> None:
        """Single setter keeping room.scores and per_player.correct_count in sync."""
        round_state.per_player[player_id].correct_count = new_count
        room.scores[player_id] = new_count

    def _compute_leaderboard(
        self, round_state: SpeedBattleRoundState
    ) -> list[SpeedBattleLeaderRow]:
        """Sort players by correct desc, wrong asc; assign shared placements (R17)."""
        sorted_players = sorted(
            round_state.per_player.items(),
            key=lambda item: (-item[1].correct_count, item[1].wrong_count),
        )
        rows: list[SpeedBattleLeaderRow] = []
        placement = 1
        for i, (player_id, progress) in enumerate(sorted_players):
            if i > 0:
                prev = sorted_players[i - 1][1]
                if (
                    progress.correct_count != prev.correct_count
                    or progress.wrong_count != prev.wrong_count
                ):
                    placement = i + 1
            rows.append(
                SpeedBattleLeaderRow(
                    playerId=player_id,
                    correctCount=progress.correct_count,
                    wrongCount=progress.wrong_count,
                    placement=placement,
                )
            )
        return rows

    def _match_remaining_ms(self, round_state: SpeedBattleRoundState) -> int:
        if round_state.ended:
            return 0
        return int(
            max(
                0,
                (round_state.match_end_monotonic - time.monotonic()) * 1000,
            )
        )

    def _refresh_shuffled_options(self, room: Room, progress: PlayerProgress) -> None:
        """Populate progress.shuffled_options for the player's current question.

        Caller MUST hold room.lock. No-op if MC is disabled, the question has
        no wrong answers, the player is exhausted, or the cache is already
        valid for the current question_index.
        """
        if not room.config.multiple_choice_enabled:
            return
        if progress.exhausted or progress.current_question_index >= len(room.questions):
            return
        q = room.questions[progress.current_question_index]
        if not q.wrong_answers:
            return
        if (
            progress.shuffled_options is not None
            and progress.shuffled_options_question_index
            == progress.current_question_index
        ):
            return
        options = [q.answer, *q.wrong_answers]
        random.shuffle(options)
        progress.shuffled_options = options
        progress.shuffled_options_question_index = progress.current_question_index

    def _make_per_recipient_closure(
        self, room: Room, round_state: SpeedBattleRoundState
    ) -> Callable[[str], dict]:
        """Return a closure that builds a per-recipient ROOM_STATE dict.

        Snapshots all mutable per-broadcast inputs (room.scores,
        round_state.per_player) under the caller's lock so concurrent
        coroutines mutating these between per-recipient sends cannot leak
        into recipients later in the iteration. Without this snapshot,
        broadcast_per_recipient awaits between sends and recipient B can
        see scores that mutated after recipient A's send.
        """
        leaderboard = (
            self._compute_leaderboard(round_state) if round_state.ended else None
        )
        match_remaining = self._match_remaining_ms(round_state)

        # Refresh each player's cached shuffled options if the cache is missing
        # or stale relative to their current question index. We do this on the
        # LIVE PlayerProgress (under the caller's lock) so the cache persists
        # across broadcasts; if we cached on the snapshot below, every
        # broadcast would reshuffle.
        for live_progress in round_state.per_player.values():
            self._refresh_shuffled_options(room, live_progress)

        # Snapshot mutable state under the caller's lock.
        scores_snapshot = dict(room.scores)
        per_player_snapshot: dict[str, PlayerProgress] = {
            pid: copy.copy(progress) for pid, progress in round_state.per_player.items()
        }
        round_state_snapshot = SpeedBattleRoundState(
            match_start_monotonic=round_state.match_start_monotonic,
            match_end_monotonic=round_state.match_end_monotonic,
            match_start_wall=round_state.match_start_wall,
            per_player=per_player_snapshot,
            ended=round_state.ended,
        )

        def build(player_id: str) -> dict:
            progress = per_player_snapshot.get(player_id)
            if progress is None:
                # Fallback: player not in round state (shouldn't happen, but safe)
                return {}
            msg = self._state_builder.build_speed_battle_state_for_player(
                room,
                player_id,
                round_state_snapshot,
                progress,
                match_remaining,
                leaderboard,
                scores_override=scores_snapshot,
            )
            return msg.to_dict()

        return build
